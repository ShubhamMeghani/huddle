import { expect, test } from 'vitest';
import { eloDeltas } from '@/engine/elo';
import { q, tx } from '@/server/db';
import { recordGame } from '@/server/effects';
import { loadRoom, roomWith } from '../helpers/unit-room';

test('AC-37 two equal 1000-rated players: winner +16, loser −16', () => {
  const d = eloDeltas([1000, 1000], [1, 2]);
  expect(d[0]).toBeCloseTo(16, 2);
  expect(d[1]).toBeCloseTo(-16, 2);
});

test('AC-37 four-player deltas match a hand computation and sum to zero', () => {
  const R = [1200, 1000, 1000, 800];
  const ranks = [2, 1, 3, 4];
  const d = eloDeltas(R, ranks);
  const E = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));
  const hand = R.map((ri, i) => {
    let s = 0;
    for (let j = 0; j < 4; j++) if (j !== i) s += (ranks[i] < ranks[j] ? 1 : ranks[i] === ranks[j] ? 0.5 : 0) - E(ri, R[j]);
    return (32 / 3) * s;
  });
  d.forEach((x, i) => expect(x).toBeCloseTo(hand[i], 2));
  expect(Math.abs(d.reduce((a, b) => a + b, 0))).toBeLessThan(0.01);
  // ties share a half point
  const t = eloDeltas([1000, 1000], [1, 1]);
  expect(t[0]).toBeCloseTo(0, 5);
});

test('ratings are stored once per finished game (R33)', async () => {
  const { code, ids } = await roomWith(['A', 'B']);
  const { state } = await loadRoom(code);
  const g = {
    gameNo: 7,
    gameId: 'ping' as const,
    settings: {},
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    teamGame: false,
    rows: ids.map((id, i) => ({ seatId: `s${i + 1}`, identityId: id.id, name: id.name, teamId: null, score: 10 - i, rank: i + 1, placementPoints: 100 - i * 100, stats: {} })),
  };
  await tx((c) => recordGame(c, state, g));
  await tx((c) => recordGame(c, state, g)); // replay: no double update
  const rows = await q<{ identity_id: string; rating: number; games: number }>(
    "select identity_id, rating, games from ratings where game_type = 'ping' and identity_id = any($1::uuid[])",
    [ids.map((i) => i.id)],
  );
  const byId = Object.fromEntries(rows.map((r) => [r.identity_id, r]));
  expect(Number(byId[ids[0].id].rating)).toBeCloseTo(1016, 1);
  expect(Number(byId[ids[1].id].rating)).toBeCloseTo(984, 1);
  expect(byId[ids[0].id].games).toBe(1);
});
