import 'server-only';
import { tx } from './db';
import { GameError } from '@/engine/types';

/** Moves a guest identity's history into a signed-in user's identity (R3, decision Q3: same device only).
 *  Results, ratings and crew memberships move; the guest is marked merged. Idempotent. */
export async function claimGuest(guestId: string | null, userIdentityId: string): Promise<{ claimed: boolean; games: number }> {
  if (!guestId) throw new GameError('INVALID', 'No guest games on this device');
  return tx(async (c) => {
    const g = await c.query("select merged_into from identities where id = $1 and kind = 'guest' for update", [guestId]);
    if (!g.rowCount) throw new GameError('INVALID', 'No guest games on this device');
    if (g.rows[0].merged_into) return { claimed: false, games: 0 };
    const moved = await c.query(
      `update game_results r set identity_id = $2 where r.identity_id = $1
       and not exists (select 1 from game_results x where x.game_id = r.game_id and x.identity_id = $2)`,
      [guestId, userIdentityId],
    );
    await c.query('delete from game_results where identity_id = $1', [guestId]);
    // Ratings: combine by games-weighted average.
    const rs = await c.query('select game_type, rating, games from ratings where identity_id = $1', [guestId]);
    for (const r of rs.rows) {
      await c.query(
        `insert into ratings (identity_id, game_type, rating, games) values ($1, $2, $3, $4)
         on conflict (identity_id, game_type) do update set
           rating = (ratings.rating * ratings.games + excluded.rating * excluded.games) / nullif(ratings.games + excluded.games, 0),
           games = ratings.games + excluded.games`,
        [userIdentityId, r.game_type, Number(r.rating), r.games],
      );
    }
    await c.query('delete from ratings where identity_id = $1', [guestId]);
    await c.query(
      `insert into crew_members (crew_id, identity_id) select crew_id, $2 from crew_members where identity_id = $1 on conflict do nothing`,
      [guestId, userIdentityId],
    );
    await c.query('delete from crew_members where identity_id = $1', [guestId]);
    await c.query('update identities set merged_into = $2 where id = $1', [guestId, userIdentityId]);
    return { claimed: true, games: moved.rowCount ?? 0 };
  });
}
