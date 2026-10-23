/* Real-services check (PLAN `npm run test:real`): the local production build against real Ably and the
 * Neon dev branch from .env.local. Values are loaded into the child processes, never printed. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { migrate } from './migrate';

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;

if (!existsSync('.env.local')) {
  console.error('.env.local is missing');
  process.exit(1);
}
process.loadEnvFile('.env.local');
for (const k of ['DATABASE_URL', 'ABLY_API_KEY', 'AUTH_SECRET']) {
  if (!process.env[k]) {
    console.error(`${k}: MISSING`);
    process.exit(1);
  }
}
delete process.env.HUDDLE_TEST_MODE;
delete process.env.REALTIME_DRIVER;

function startServer(): ChildProcess {
  return spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    env: { ...process.env, NODE_ENV: 'production', AUTH_URL: BASE },
    stdio: 'ignore',
  });
}

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/api/identity/me`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not start');
}

function run(cmd: string[], extraEnv: Record<string, string> = {}): number {
  const r = spawnSync(process.execPath, cmd, { stdio: 'inherit', env: { ...process.env, DEPLOY_URL: BASE, ...extraEnv } });
  return r.status ?? 1;
}

async function main() {
  await migrate(process.env.DATABASE_URL!);
  let server = startServer();
  await waitUp();
  const pw = ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.deploy.config.ts'];
  let failures = 0;
  const only = process.argv.indexOf('--grep'); // `--grep <pattern>`: run just those deploy tests
  if (only > 0) {
    failures += run([...pw, '--grep', process.argv[only + 1]]) ? 1 : 0;
    server.kill();
    process.exit(failures ? 1 : 0);
  }
  if (!process.argv.includes('--probe-only')) {
    failures += run([...pw, '--grep', 'AC-77|AC-80|AC-87|@skeleton|@before-restart']) ? 1 : 0;
    server.kill();
    await new Promise((r) => setTimeout(r, 2000));
    server = startServer();
    await waitUp();
    failures += run([...pw, '--grep', '@after-restart']) ? 1 : 0;
  }
  failures += run(['node_modules/tsx/dist/cli.mjs', 'scripts/probe-draw.ts']) ? 1 : 0;
  server.kill();
  console.log(failures ? `test:real: ${failures} step(s) failed` : 'test:real: all steps passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
