import { expect, test } from 'vitest';
import { balanceIndices } from '@/engine/teams';
import { strengthFor } from '@/engine/elo';
import { harness } from '../helpers/engine';
import { applyAction } from '@/engine/room';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('AC-35 six ratings in two teams: 3 + 3 with means within 34 points', () => {
  const r = [1400, 1300, 1200, 1100, 1000, 900];
  const g = balanceIndices(r, 2);
  expect(g.map((x) => x.length).sort()).toEqual([3, 3]);
  const means = g.map((grp) => mean(grp.map((i) => r[i])));
  expect(Math.abs(means[0] - means[1])).toBeLessThanOrEqual(34);
});

test('AC-35 seven players in three teams are sized 3/2/2 and the result is deterministic', () => {
  const r = [1210, 990, 1005, 1300, 870, 1100, 1000];
  const a = balanceIndices(r, 3);
  const b = balanceIndices(r, 3);
  expect(a).toEqual(b);
  expect(a.map((x) => x.length).sort()).toEqual([2, 2, 3]);
  expect(a.flat().sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test('AC-35 new players default to 1000; strength falls back to the mean of other game ratings', () => {
  expect(strengthFor(undefined, 'quiz')).toBe(1000);
  expect(strengthFor({ quiz: 1100 }, 'quiz')).toBe(1100);
  expect(strengthFor({ quiz: 1100, draw: 900 }, 'charades')).toBe(1000);
});

test('team balancing in the engine uses server-loaded ratings, never client-supplied numbers', () => {
  const h = harness(['A', 'B', 'C', 'D']);
  const ctx = h.ctx();
  ctx.ratings = { 'id-A': { charades: 1400 }, 'id-B': { charades: 1300 }, 'id-C': { charades: 900 }, 'id-D': { charades: 800 } };
  h.room.queue = [{ gameId: 'ping', settings: {} }];
  applyAction(h.room, h.seat('A'), { type: 'setTeams', mode: 'balance', count: 2, ratings: { 'id-A': 99999 } }, ctx);
  const teamOf = (n: string) => h.room.teams!.find((t) => t.seatIds.includes(h.seat(n).id))!.id;
  expect(teamOf('A')).not.toBe(teamOf('B')); // the two strongest are split
  expect(h.room.teams!.every((t) => t.seatIds.length === 2)).toBe(true);
});
