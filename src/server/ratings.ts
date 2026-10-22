import 'server-only';
import type { Tx } from './db';
import type { FinishedGame } from '@/engine/types';
import { eloDeltas, START_RATING } from '@/engine/elo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Updates per-identity, per-game ratings once per finished game (called inside recordGame's insert-once path). */
export async function recordRatings(c: Tx, g: FinishedGame): Promise<void> {
  const rows = g.rows.filter((r) => UUID.test(r.identityId));
  if (rows.length < 2) return;
  const ids = rows.map((r) => r.identityId);
  const cur = await c.query('select identity_id, rating from ratings where game_type = $1 and identity_id = any($2::uuid[])', [g.gameId, ids]);
  const map = new Map<string, number>(cur.rows.map((r: { identity_id: string; rating: number }) => [r.identity_id, Number(r.rating)]));
  const ratings = ids.map((id) => map.get(id) ?? START_RATING);
  const deltas = eloDeltas(ratings, rows.map((r) => r.rank));
  for (let i = 0; i < ids.length; i++) {
    await c.query(
      `insert into ratings (identity_id, game_type, rating, games) values ($1, $2, $3, 1)
       on conflict (identity_id, game_type) do update set rating = $3, games = ratings.games + 1`,
      [ids[i], g.gameId, ratings[i] + deltas[i]],
    );
  }
}
