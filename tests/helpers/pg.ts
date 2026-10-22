/* Throwaway Postgres for tests: embedded-postgres locally, or TEST_DATABASE_URL (CI service). */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { migrate } from '../../scripts/migrate';

export interface TestDb {
  url: string;
  stop: () => Promise<void>;
}

async function createDatabase(adminUrl: string, name: string): Promise<string> {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  await c.query(`create database ${name} encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`);
  await c.end();
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  return u.toString();
}

export async function startTestDb(label: string, port: number): Promise<TestDb> {
  const dbName = `huddle_${label}_${Date.now()}`;
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    const url = await createDatabase(external, dbName);
    await migrate(url, false);
    return { url, stop: async () => {} };
  }
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = join(process.cwd(), '.cache', `pg-${label}`);
  rmSync(dir, { recursive: true, force: true });
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  const url = await createDatabase(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, dbName);
  await migrate(url, false);
  return {
    url,
    stop: async () => {
      await server.stop();
    },
  };
}
