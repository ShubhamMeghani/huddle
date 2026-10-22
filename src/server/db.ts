import 'server-only';
import pg from 'pg';
import { Pool as NeonPool } from '@neondatabase/serverless';

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
  // Neon's serverless driver on Vercel; plain pg locally, in CI and in tests.
  if (process.env.VERCEL) return new NeonPool({ connectionString, max: 5 }) as unknown as AnyPool;
  return new pg.Pool({ connectionString, max: 10 }) as unknown as AnyPool;
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
