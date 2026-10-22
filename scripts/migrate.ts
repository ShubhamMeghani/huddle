/* Applies db/migrations/*.sql in order, each once, under a transaction-scoped lock
 * (works through Neon's pooler). Prints migration names only, never connection details. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export async function migrate(connectionString: string, log = true): Promise<string[]> {
  const dir = join(process.cwd(), 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    for (const name of files) {
      await client.query('begin');
      try {
        await client.query('lock table schema_migrations in exclusive mode');
        const done = await client.query('select 1 from schema_migrations where name = $1', [name]);
        if (done.rowCount === 0) {
          await client.query(readFileSync(join(dir, name), 'utf8'));
          await client.query('insert into schema_migrations (name) values ($1)', [name]);
          applied.push(name);
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }
  } finally {
    await client.end();
  }
  if (log) console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Migrations up to date');
  return applied;
}

const isMain = process.argv[1] && /migrate\.ts$/.test(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  migrate(url).catch((e) => {
    console.error('Migration failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
