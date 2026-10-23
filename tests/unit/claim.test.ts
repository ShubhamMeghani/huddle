import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { q } from '@/server/db';
import { claimGuest } from '@/server/claim';
import { makeIdentity } from '../helpers/unit-room';

async function userIdentity(name: string) {
  const u = await q<{ id: string }>('insert into users (google_sub, name) values ($1, $2) returning id', [`test:${randomUUID()}`, name]);
  const i = await q<{ id: string }>("insert into identities (kind, display_name, user_id) values ('user', $1, $2) returning id", [name, u[0].id]);
  return i[0].id;
}

test('AC-4 claiming moves results, ratings and crew memberships to the user, marks the guest merged, and is idempotent', async () => {
  const guest = await makeIdentity('Priya (guest)');
  const user = await userIdentity('Priya');
  const room = (await q<{ id: string }>("insert into rooms (code, state, expires_at) values ('CLMA', '{}', now() + interval '1 day') returning id"))[0].id;
  const game = (await q<{ id: string }>("insert into games (room_id, game_no, game_type, settings, started_at, ended_at) values ($1, 1, 'quiz', '{}', now(), now()) returning id", [room]))[0].id;
  await q("insert into game_results (game_id, identity_id, display_name, rank, score, placement_points) values ($1, $2, 'Priya', 1, 900, 100)", [game, guest.id]);
  await q("insert into ratings (identity_id, game_type, rating, games) values ($1, 'quiz', 1020, 2)", [guest.id]);
  await q("insert into ratings (identity_id, game_type, rating, games) values ($1, 'quiz', 980, 2)", [user]);
  const crew = (await q<{ id: string }>("insert into crews (name, invite_token) values ('Claimers', $1) returning id", [randomUUID()]))[0].id;
  await q('insert into crew_members (crew_id, identity_id) values ($1, $2)', [crew, guest.id]);

  const r = await claimGuest(guest.id, user);
  expect(r).toEqual({ claimed: true, games: 1 });
  expect(await q('select 1 from game_results where identity_id = $1', [user])).toHaveLength(1);
  expect(await q('select 1 from game_results where identity_id = $1', [guest.id])).toHaveLength(0);
  const rating = await q<{ rating: number; games: number }>("select rating, games from ratings where identity_id = $1 and game_type = 'quiz'", [user]);
  expect(Number(rating[0].rating)).toBeCloseTo(1000, 5);
  expect(rating[0].games).toBe(4);
  expect(await q('select 1 from crew_members where crew_id = $1 and identity_id = $2', [crew, user])).toHaveLength(1);
  expect((await q<{ merged_into: string }>('select merged_into from identities where id = $1', [guest.id]))[0].merged_into).toBe(user);

  expect(await claimGuest(guest.id, user)).toEqual({ claimed: false, games: 0 }); // second claim: no-op
  await expect(claimGuest(null, user)).rejects.toMatchObject({ code: 'INVALID' }); // no guest cookie on this device
});
