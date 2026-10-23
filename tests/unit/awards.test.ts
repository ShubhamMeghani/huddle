import { expect, test } from 'vitest';
import { computeAwards } from '@/engine/awards';
import type { FinishedGame } from '@/engine/types';

type Row = FinishedGame['rows'][number];
const row = (seatId: string, name: string, rank: number, pp: number, stats: Record<string, number> = {}): Row => ({
  seatId,
  identityId: `id-${seatId}`,
  name,
  teamId: null,
  score: 0,
  rank,
  placementPoints: pp,
  stats: { afkSkips: 0, missed: 0, ...stats },
});
const game = (gameNo: number, gameId: FinishedGame['gameId'], rows: Row[], extra: Partial<FinishedGame> = {}): FinishedGame => ({
  gameNo,
  gameId,
  settings: {},
  startedAt: 0,
  endedAt: 1,
  teamGame: false,
  rows,
  ...extra,
});

const night: FinishedGame[] = [
  game(1, 'quiz', [
    row('s1', 'Asha', 1, 100, { quizCorrect: 6, quizMedianMs: 3200 }),
    row('s2', 'Bilal', 2, 50, { quizCorrect: 7, quizMedianMs: 2100 }),
    row('s3', 'Charu', 3, 0, { quizCorrect: 4, quizMedianMs: 900 }), // fastest but fewer than 5 correct
  ]),
  game(2, 'draw', [
    row('s2', 'Bilal', 1, 100, { drawTurns: 1, drawerPoints: 180 }),
    row('s1', 'Asha', 2, 50, { drawTurns: 1, drawerPoints: 120 }),
    row('s3', 'Charu', 3, 0, { drawTurns: 1, drawerPoints: 60, afkSkips: 2, missed: 2 }),
  ]),
  game(3, 'imposter', [
    row('s3', 'Charu', 1, 100, { imposterWins: 1, votesReceived: 1 }),
    row('s1', 'Asha', 2, 50, { imposterWins: 1, votesReceived: 3 }),
    row('s2', 'Bilal', 3, 0),
  ]),
];

test('AC-53 a fixture night produces the expected MVP, Best Artist, Fastest Finger, Best Imposter and Most AFK', () => {
  const awards = Object.fromEntries(computeAwards(night).map((a) => [a.award, a.name]));
  // Asha 200 pp vs Bilal 150 vs Charu 100.
  expect(awards).toEqual({ MVP: 'Asha', 'Best Artist': 'Bilal', 'Fastest Finger': 'Bilal', 'Best Imposter': 'Charu', 'Most AFK': 'Charu' });
});

test('AC-53 awards for unplayed games are omitted; Most AFK is omitted when nobody went AFK; ties follow the rules', () => {
  const quizOnly = [
    game(1, 'quiz', [row('s2', 'Bilal', 1, 100, { quizCorrect: 5, quizMedianMs: 2000 }), row('s1', 'Asha', 1, 100, { quizCorrect: 6, quizMedianMs: 2000 })]),
  ];
  const awards = computeAwards(quizOnly);
  expect(awards.map((a) => a.award)).toEqual(['MVP', 'Fastest Finger']);
  // MVP tie on points and wins → earlier join (s1) wins. Fastest Finger tie on time → more correct answers (Asha).
  expect(awards.find((a) => a.award === 'MVP')!.name).toBe('Asha');
  expect(awards.find((a) => a.award === 'Fastest Finger')!.name).toBe('Asha');
  expect(computeAwards([game(1, 'mlt', [row('s1', 'Asha', 1, 0)], { excludeFromSeason: true })])).toEqual([]);
});
