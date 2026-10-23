import { expect, test } from 'vitest';
import { placementPoints, ranks } from '@/engine/core';
import { seasonLeaderboard, seasonOf, type ResultRow } from '@/lib/stats';

test('AC-51 placement points: n = 2, 4 and 7, with ties averaging the positions they cover', () => {
  expect(placementPoints([10, 5])).toEqual([100, 0]);
  expect(placementPoints([40, 30, 20, 10])).toEqual([100, 67, 33, 0]);
  expect(placementPoints([7, 6, 5, 4, 3, 2, 1])).toEqual([100, 83, 67, 50, 33, 17, 0]);
  // Two tied for 2nd of 4 cover positions 2 and 3 → average position 2.5 → 50 each.
  expect(placementPoints([40, 20, 20, 10])).toEqual([100, 50, 50, 0]);
  expect(placementPoints([5, 5])).toEqual([50, 50]);
  expect(placementPoints([9])).toEqual([0]);
  expect(ranks([40, 20, 20, 10])).toEqual([1, 2, 2, 4]);
});

test('AC-51 seasons are calendar months in IST: 31 Oct 23:59 and 1 Nov 00:01 IST fall in different seasons', () => {
  const oct31 = Date.UTC(2026, 9, 31, 18, 29); // 23:59 IST
  const nov1 = Date.UTC(2026, 9, 31, 18, 31); // 00:01 IST on 1 Nov
  expect(seasonOf(oct31)).toBe('2026-10');
  expect(seasonOf(nov1)).toBe('2026-11');
});

test('AC-51 leaderboard ordering: points, then wins, then average; ties share a rank; other seasons and fun games excluded', () => {
  const oct = Date.UTC(2026, 9, 10, 12);
  const nov = Date.UTC(2026, 10, 10, 12);
  const row = (identityId: string, gameId: string, pp: number, rank: number, endedAt = oct, gameType = 'quiz'): ResultRow => ({
    gameId,
    gameType,
    endedAt,
    excludeFromSeason: gameType === 'mlt',
    identityId,
    name: identityId.toUpperCase(),
    rank,
    score: 0,
    placementPoints: pp,
    stats: {},
  });
  const rows = [
    row('a', 'g1', 100, 1),
    row('b', 'g1', 0, 2),
    row('b', 'g2', 100, 1),
    row('a', 'g2', 0, 2),
    row('c', 'g3', 100, 1),
    row('a', 'g3', 0, 2),
    row('c', 'g4', 0, 2, nov),
    row('a', 'g5', 0, 1, oct, 'mlt'),
  ];
  const board = seasonLeaderboard(rows, '2026-10');
  // Equal points and wins: higher average first (c 100, b 50, a 33); all share rank 1.
  expect(board.map((r) => [r.identityId, r.points, r.games, r.wins, r.average, r.rank])).toEqual([
    ['c', 100, 1, 1, 100, 1],
    ['b', 100, 2, 1, 50, 1],
    ['a', 100, 3, 1, 33, 1],
  ]);
  const withMembers = seasonLeaderboard(rows, '2026-10', new Set(['a', 'b']));
  expect(withMembers.map((r) => r.identityId)).toEqual(['b', 'a']); // b: average 50 beats a: average 33
});
