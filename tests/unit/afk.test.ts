import { expect, test } from 'vitest';
import { BANK } from '@/games/quiz/rules';
import { harness, startQueue, touchAll } from '../helpers/engine';

const ALL = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];

test('AC-27 AFK players do not block early ends: a quiz question ends when all non-AFK players answered', () => {
  const h = harness(['A', 'B', 'C']);
  startQueue(h, [{ gameId: 'quiz', settings: { questions: 3, seconds: 20, categories: ALL, difficulty: 'any', mode: 'solo' } }]);
  h.seat('C').afk = true;
  const st = h.room.game!.state as { ids: string[]; idx: number };
  const answer = BANK.find((q) => q.id === st.ids[st.idx])!.answer;
  h.act('A', { type: 'answer', choice: answer });
  h.act('B', { type: 'answer', choice: (answer + 1) % 4 });
  expect(h.room.phase.kind).toBe('reveal');
});

test('AC-27 AFK guessers do not block the end of a Draw turn', () => {
  const h = harness(['Dr', 'G1', 'G2']);
  startQueue(h, [{ gameId: 'draw', settings: { rounds: 1, drawSeconds: 80, hints: 0, words: 'mixed' } }]);
  h.act('Dr', { type: 'choose', index: 0 });
  h.seat('G2').afk = true;
  const word = (h.room.game!.state as { word: string }).word;
  h.act('G1', { type: 'guess', text: word });
  expect(h.room.phase.kind).toBe('turnEnd');
});

test('AC-27 an AFK Atlas player still gets turns and loses a life on timeout as normal', () => {
  const h = harness(['A', 'B', 'C']);
  startQueue(h, [{ gameId: 'atlas', settings: { seconds: 10, lives: 2, variant: 'any' } }]);
  h.seat('A').afk = true;
  expect(h.room.phase.turnSeatId).toBe(h.seat('A').id); // not skipped
  h.clock.advance(10_001);
  touchAll(h);
  h.tick();
  const s = h.room.game!.state as { lives: Record<string, number> };
  expect(s.lives[h.seat('A').id]).toBe(1);
  expect(h.room.phase.turnSeatId).toBe(h.seat('B').id);
});
