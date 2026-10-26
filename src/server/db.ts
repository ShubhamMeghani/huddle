import 'server-only';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};
type AnyPool = Queryable & { connect: () => Promise<Queryable & { release: () => void }> };

declare global {
  var __huddlePool: AnyPool | undefined;
}

function createPool(): AnyPool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing environment variable DATABASE_URL');
  // Getting a connection may not hang forever. The limit also bounds waiting for a free pool slot, so it matches the
  // client's 30 s action timeout: a burst queued on one room's row lock waits instead of failing.
  const opts = { max: 10, connectionTimeoutMillis: 30_000, keepAlive: true };
  if (process.env.VERCEL) {
    // TCP pg to Neon's pooled endpoint. Idle timeouts don't run while Vercel suspends an instance, so a reused
    // connection can be dead on wake and hang the next query; attachDatabasePool closes idle ones before suspension.
    const p = new pg.Pool({ connectionString, idleTimeoutMillis: 5_000, ...opts });
    attachDatabasePool(p);
    return p as unknown as AnyPool;
  }
  return new pg.Pool({ connectionString, ...opts }) as unknown as AnyPool;
}

export function pool(): AnyPool {
  if (!globalThis.__huddlePool) globalThis.__huddlePool = createPool();
  return globalThis.__huddlePool;
}

export type Tx = Queryable;

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(text, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
