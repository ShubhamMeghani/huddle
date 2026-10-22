/* Starts a throwaway Postgres and the production build (`next start`) in test mode for Playwright. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { startTestDb } from '../tests/helpers/pg';
import { SENTINELS } from '../tests/helpers/sentinels';

const PORT = Number(process.env.E2E_PORT ?? 3100);

async function main() {
  const db = await startTestDb('e2e', 54330);
  mkdirSync('.cache', { recursive: true });
  writeFileSync('.cache/e2e-db.json', JSON.stringify({ url: db.url }));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    HUDDLE_TEST_MODE: '1',
    REALTIME_DRIVER: 'local',
    DATABASE_URL: db.url,
    ABLY_API_KEY: SENTINELS.ABLY_API_KEY,
    AUTH_SECRET: SENTINELS.AUTH_SECRET,
    AUTH_GOOGLE_ID: '',
    AUTH_GOOGLE_SECRET: '',
    AUTH_URL: `http://localhost:${PORT}`,
    HUDDLE_ADMIN_GRACE_MS: '5000',
    HUDDLE_PRESENCE_MS: '4000',
    HUDDLE_BREAK_MS: '8000',
    HUDDLE_SILENCE_MS: '120000',
  };
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    env,
    stdio: 'inherit',
  });
  const shutdown = async () => {
    child.kill();
    await db.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  child.on('exit', async (code) => {
    await db.stop().catch(() => {});
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
