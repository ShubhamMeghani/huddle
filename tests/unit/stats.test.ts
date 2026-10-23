import { expect, test } from 'vitest';
import { headToHead, perGameStats, type ResultRow } from '@/lib/stats';

const r = (identityId: string, gameId: string, gameType: string, rank: number, stats: Record<string, number> = {}): ResultRow => ({
  gameId,
  gameType,
  endedAt: Date.UTC(2026, 9, 1),
  excludeFromSeason: false,
  identityId,
  name: identityId,
  rank,
  score: 0,
  placementPoints: 0,
  stats,
});

const rows: ResultRow[] = [
  r('a', 'q1', 'quiz', 1, { quizCorrect: 8, quizAnswered: 10 }),
  r('b', 'q1', 'quiz', 2, { quizCorrect: 5, quizAnswered: 10 }),
  r('a', 'q2', 'quiz', 2, { quizCorrect: 4, quizAnswered: 10 }),
  r('b', 'q2', 'quiz', 1, { quizCorrect: 9, quizAnswered: 10 }),
  r('a', 'd1', 'draw', 1, { drawTurns: 2, drawerPoints: 180 }),
  r('b', 'd1', 'draw', 1, { drawTurns: 2, drawerPoints: 60 }),
  r('a', 'i1', 'imposter', 2, { imposterRounds: 2, imposterWins: 1 }),
  r('a', 'at1', 'atlas', 1, { placesNamed: 7 }),
  r('c', 'at1', 'atlas', 2, { placesNamed: 3 }),
];

test('AC-52 per-game stats: played, wins, average rank, accuracy, drawer points, places named, imposter win rate', () => {
  const a = Object.fromEntries(perGameStats(rows, 'a').map((s) => [s.gameType, s]));
  expect(a.quiz).toMatchObject({ played: 2, wins: 1, averageRank: 1.5, extra: { accuracy: 60 } });
  expect(a.draw).toMatchObject({ played: 1, wins: 1, extra: { avgDrawerPoints: 90 } });
  expect(a.atlas.extra.placesNamed).toBe(7);
  expect(a.imposter.extra.imposterWinRate).toBe(50);
});

test('AC-52 head-to-head counts games together and who placed higher', () => {
  expect(headToHead(rows, 'a', 'b')).toEqual({ together: 3, aAhead: 1, bAhead: 1, tied: 1 });
  expect(headToHead(rows, 'a', 'c')).toEqual({ together: 1, aAhead: 1, bAhead: 0, tied: 0 });
  expect(headToHead(rows, 'b', 'c')).toEqual({ together: 0, aAhead: 0, bAhead: 0, tied: 0 });
});
