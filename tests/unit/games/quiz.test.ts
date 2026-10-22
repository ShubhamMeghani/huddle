import { describe, expect, test } from 'vitest';
import { BANK, pointsFor, selectQuestions } from '@/games/quiz/rules';
import { seededRng } from '@/engine/rng';
import { harness, startQueue, touchAll } from '../../helpers/engine';
import { publicView } from '@/engine/room';

const ALL = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];
const quiz = (extra: Record<string, unknown> = {}) => [
  { gameId: 'quiz' as const, settings: { questions: 3, seconds: 20, categories: ALL, difficulty: 'any', mode: 'solo', ...extra } },
];

function correctOf(h: ReturnType<typeof harness>): number {
  const id = (h.room.game!.state as { ids: string[]; idx: number }).ids[(h.room.game!.state as { idx: number }).idx];
  return BANK.find((q) => q.id === id)!.answer;
}

describe('Quiz Clash rules', () => {
  test('AC-57 scoring: correct at the start = 1000, at the deadline = 500, wrong = 0', () => {
    expect(pointsFor(true, 0, 20_000)).toBe(1000);
    expect(pointsFor(true, 20_000, 20_000)).toBe(500);
    expect(pointsFor(true, 10_000, 20_000)).toBe(750);
    expect(pointsFor(false, 0, 20_000)).toBe(0);
  });

  test('AC-57 one lock-in only; the question ends early when all active players answered', () => {
    const h = harness(['A', 'B', 'C']);
    startQueue(h, quiz());
    const c = correctOf(h);
    h.act('A', { type: 'answer', choice: c });
    expect(() => h.act('A', { type: 'answer', choice: (c + 1) % 4 })).toThrow(/already locked/i);
    h.clock.advance(5_000);
    touchAll(h);
    h.act('B', { type: 'answer', choice: (c + 1) % 4 });
    expect(h.room.phase.kind).toBe('question');
    h.act('C', { type: 'answer', choice: c });
    expect(h.room.phase.kind).toBe('reveal');
    expect(h.seat('A').score).toBe(1000);
    expect(h.seat('B').score).toBe(0);
    expect(h.seat('C').score).toBe(875); // answered at 5 s of 20 s: 500 + 500 × 15/20
  });

  test('AC-57 the correct answer is not in the public view until the reveal', () => {
    const h = harness(['A', 'B']);
    startQueue(h, quiz());
    const view = () => JSON.stringify(publicView(h.room, {}, h.clock.now));
    expect(JSON.parse(view()).game.view.reveal).toBeNull();
    expect(view()).not.toMatch(/"answer"|"correct"/);
    h.act('A', { type: 'answer', choice: 0 });
    h.act('B', { type: 'answer', choice: 1 });
    expect(JSON.parse(view()).game.view.reveal.correct).toBe(correctOf(h));
  });

  test('AC-57 team mode scores each team the average of its members', () => {
    const h = harness(['A', 'B', 'C', 'D']);
    h.act('A', { type: 'setTeams', mode: 'shuffle', count: 2 });
    const teams = h.room.teams!;
    startQueue(h, quiz({ mode: 'teams' }));
    const c = correctOf(h);
    const [t1, t2] = teams;
    // Team 1: one right (instant, 1000), one wrong → avg 500. Team 2: both wrong → 0.
    h.act(h.room.seats.find((s) => s.id === t1.seatIds[0])!, { type: 'answer', choice: c });
    h.act(h.room.seats.find((s) => s.id === t1.seatIds[1])!, { type: 'answer', choice: (c + 1) % 4 });
    h.act(h.room.seats.find((s) => s.id === t2.seatIds[0])!, { type: 'answer', choice: (c + 1) % 4 });
    h.act(h.room.seats.find((s) => s.id === t2.seatIds[1])!, { type: 'answer', choice: (c + 2) % 4 });
    expect(h.room.teamScores[t1.id]).toBe(500);
    expect(h.room.teamScores[t2.id]).toBe(0);
  });

  test('AC-57 no question repeats in a room until the matching pool is exhausted', () => {
    const rng = seededRng('x');
    const small = BANK.filter((q) => q.category === 'cricket');
    const used = new Set<string>();
    const seen: string[] = [];
    for (let round = 0; round < Math.floor(small.length / 10); round++) {
      const ids = selectQuestions({ questions: 10, categories: ['cricket'], difficulty: 'any' }, used, new Set(), rng, small);
      for (const id of ids) {
        expect(used.has(id)).toBe(false);
        used.add(id);
        seen.push(id);
      }
    }
    // Pool exhausted: the next selection may reuse, but still returns a full set.
    const after = selectQuestions({ questions: 10, categories: ['cricket'], difficulty: 'any' }, used, new Set(), rng, small);
    expect(after).toHaveLength(10);
    expect(new Set(seen).size).toBe(seen.length);
  });

  test('a game ends with stats for Fastest Finger after all questions', () => {
    const h = harness(['A', 'B']);
    startQueue(h, quiz());
    for (let i = 0; i < 3; i++) {
      const c = correctOf(h);
      h.clock.advance(1000);
      touchAll(h);
      h.act('A', { type: 'answer', choice: c });
      h.act('B', { type: 'answer', choice: (c + 1) % 4 });
      h.clock.advance(8_001); // the reveal lasts 8 s in test mode (5 s in production)
      touchAll(h);
      h.tick();
    }
    expect(h.room.status).toBe('break');
    const a = h.room.lastGame!.rows.find((r) => r.name === 'A')!;
    expect(a.rank).toBe(1);
    expect(a.stats.quizCorrect).toBe(3);
    expect(a.stats.quizMedianMs).toBeGreaterThanOrEqual(1000);
    expect(a.stats.quizMedianMs).toBeLessThan(1100);
  });
});
