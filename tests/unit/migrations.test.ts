import { expect, test } from 'vitest';
import pg from 'pg';
import { migrate } from '../../scripts/migrate';

test('migrations are idempotent: a second run applies nothing and all tables exist', async () => {
  const url = process.env.DATABASE_URL!;
  expect(await migrate(url, false)).toEqual([]);
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const r = await c.query("select table_name from information_schema.tables where table_schema = 'public'");
  await c.end();
  const names = r.rows.map((x) => x.table_name);
  for (const t of ['identities', 'users', 'rooms', 'room_actions', 'presence', 'strokes', 'games', 'game_results', 'nights', 'ratings', 'crews', 'crew_members']) {
    expect(names).toContain(t);
  }
});
