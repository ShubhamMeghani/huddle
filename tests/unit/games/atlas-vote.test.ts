import { expect, test } from 'vitest';
import { voteAccepts } from '@/games/atlas/rules';
import { harness, startQueue, touchAll } from '../../helpers/engine';

test('AC-69 a majority of votes cast accepts; a tie or no votes rejects', () => {
  expect(voteAccepts([true, true, false])).toBe(true);
  expect(voteAccepts([true, false])).toBe(false);
  expect(voteAccepts([])).toBe(false);
  expect(voteAccepts([false])).toBe(false);
  expect(voteAccepts([true])).toBe(true);
});

test('AC-69 the turn timer pauses during the vote and resumes with the same time left', () => {
  const h = harness(['A', 'B', 'C']);
  startQueue(h, [{ gameId: 'atlas', settings: { seconds: 20, lives: 1, variant: 'any' } }]);
  const s = h.room.game!.state as { letter: string; chain: { name: string }[] };
  s.letter = 'q';
  h.clock.advance(6_000); // 14 s left
  touchAll(h);
  const ctx = h.act('A', { type: 'submit', text: 'Quokkaville' });
  expect(h.room.phase.kind).toBe('vote');
  h.clock.advance(3_000);
  touchAll(h);
  h.act('B', { type: 'vote', accept: false });
  h.act('C', { type: 'vote', accept: true }); // tie → rejected
  expect(h.room.phase.kind).toBe('turn');
  expect(h.room.phase.turnSeatId).toBe(h.seat('A').id);
  expect(h.room.phase.deadline! - h.clock.now).toBe(14_000);
  expect(h.ctx().effects).toEqual([]);
  void ctx;

  h.act('A', { type: 'submit', text: 'Quokkatown' });
  h.act('B', { type: 'vote', accept: true });
  h.act('C', { type: 'vote', accept: true });
  expect(s.chain.map((c) => c.name)).toEqual(['Quokkatown']);
  expect(h.seat('A').score).toBe(10);
});
