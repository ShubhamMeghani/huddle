import { describe, expect, test } from 'vitest';
import bot from '../../../content/npat-bot.json';
import { buildItems, LETTERS, scoreItems, standsAfterVote, type Item } from '@/games/npat/rules';
import { privateView, publicView } from '@/engine/room';
import { fold } from '@/lib/text';
import { harness, startQueue, touchAll, type Harness } from '../../helpers/engine';

function game(opts: { rounds?: number; movie?: boolean; names?: string[] } = {}): Harness {
  const h = harness(opts.names ?? ['A', 'B', 'C']);
  startQueue(h, [{ gameId: 'npat', settings: { rounds: opts.rounds ?? 1, seconds: 60, movie: opts.movie ?? false } }]);
  h.room.game!.state.letter = 'b';
  return h;
}
const id = (h: Harness, n: string) => h.seat(n).id;
const toDeadline = (h: Harness) => {
  h.clock.advance(h.room.phase.deadline! - h.clock.now + 1);
  touchAll(h);
  h.tick();
};
const item = (h: Harness, key: string) => (h.room.game!.state.items as Item[]).find((i) => i.key === key)!;

describe('Name Place Animal Thing', () => {
  test('AC-97 the bot word bank covers every letter, and every word starts with its letter', () => {
    for (const l of LETTERS) {
      const entry = (bot as Record<string, Record<string, string[]>>)[l];
      expect(entry, l).toBeDefined();
      for (const cat of ['name', 'thing']) expect(entry[cat].length, `${l} ${cat}`).toBeGreaterThan(0);
      for (const words of Object.values(entry)) for (const w of words) expect(fold(w)[0], w).toBe(l);
    }
    expect(LETTERS).not.toContain('q');
    expect(LETTERS).not.toContain('x');
    expect(LETTERS).not.toContain('z');
  });

  test('AC-97 each round has a new random letter (never Q, X or Z)', () => {
    const h = harness(['A', 'B']);
    startQueue(h, [{ gameId: 'npat', settings: { rounds: 10, seconds: 60, movie: false } }]);
    const letters: string[] = [];
    while (h.room.status === 'playing') {
      letters.push(h.room.game!.state.letter);
      h.act('A', { type: 'done' });
      h.act('B', { type: 'done' });
      expect(h.room.phase.kind).toBe('results'); // nothing written, nothing to vote on
      toDeadline(h);
    }
    expect(letters).toHaveLength(10);
    expect(new Set(letters).size).toBe(10);
    for (const l of letters) expect(LETTERS).toContain(l);
  });

  test('AC-97 answers stay secret until the writing ends; each player sees only their own', () => {
    const h = game();
    h.act('A', { type: 'fill', answers: { name: 'Bunty', place: 'Bhopal' } });
    const pub = JSON.stringify(publicView(h.room, {}, h.clock.now));
    expect(pub).not.toContain('Bunty');
    expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: id(h, 'B') }))).not.toContain('Bunty');
    expect(JSON.stringify(privateView(h.room, { kind: 'screen' }))).not.toContain('Bunty');
    expect(privateView(h.room, { kind: 'player', seatId: id(h, 'A') }).game).toMatchObject({ mine: { name: 'Bunty', place: 'Bhopal' }, done: false });
    for (const n of ['A', 'B', 'C']) h.act(n, { type: 'done' });
    expect(JSON.stringify(publicView(h.room, {}, h.clock.now))).toContain('Bunty');
  });

  test('AC-97 places are checked against the Atlas database and grouped by place (Bengaluru = Bangalore); a wrong letter never counts; the rest goes to a vote', () => {
    const items = buildItems(
      {
        A: { name: 'Bunty', place: 'Bengaluru', animal: 'Bear', thing: 'Mug' },
        B: { name: 'Bilal', place: 'Bangalore', animal: 'bear ', thing: 'Bucket' },
        C: { place: 'Bhoot Nagar', animal: '' },
      },
      ['name', 'place', 'animal', 'thing'],
      'b',
    );
    const place = items.filter((i) => i.cat === 'place');
    expect(place).toHaveLength(2);
    const known = place.find((i) => i.check === 'ok')!;
    expect(known.seatIds).toEqual(['A', 'B']);
    expect(place.find((i) => i.text === 'Bhoot Nagar')!.check).toBe('vote');
    expect(items.find((i) => i.cat === 'animal')).toMatchObject({ check: 'vote', seatIds: ['A', 'B'] });
    expect(items.find((i) => i.text === 'Mug')!.check).toBe('bad');
    expect(items.find((i) => i.text === 'Bunty')).toMatchObject({ check: 'vote', seatIds: ['A'] });
    expect(items.some((i) => i.cat === 'animal' && i.seatIds.includes('C'))).toBe(false); // blanks are not answers
  });

  test('AC-97 an answer stands unless more than half of the other active players reject it; unique valid answers score 10, shared 5', () => {
    expect(standsAfterVote(2, 3)).toBe(false);
    expect(standsAfterVote(1, 3)).toBe(true);
    expect(standsAfterVote(2, 4)).toBe(true); // a tie keeps the answer
    expect(standsAfterVote(1, 1)).toBe(false);
    expect(standsAfterVote(0, 0)).toBe(true);
    const base = { cat: 'name' as const, check: 'vote' as const, rejects: 0 };
    expect(
      scoreItems([
        { ...base, key: 'a', text: 'x', seatIds: ['A'], valid: true },
        { ...base, key: 'b', text: 'y', seatIds: ['A', 'B'], valid: true },
        { ...base, key: 'c', text: 'z', seatIds: ['C'], valid: false },
      ]),
    ).toEqual({ A: 15, B: 5, C: 0 });
  });

  test('AC-97 a full round: vote, rejections (not on your own answer, can be withdrawn), early ends and scores', () => {
    const h = game();
    h.act('A', { type: 'done', answers: { name: 'Bunty', place: 'Bengaluru', animal: 'Bear', thing: 'Bat' } });
    h.act('B', { type: 'done', answers: { name: 'Bilal', place: 'Bangalore', animal: 'Bear', thing: 'Mug' } });
    expect(() => h.act('A', { type: 'fill', answers: { name: 'Bob' } })).toThrow(/Already locked in/);
    h.act('C', { type: 'done', answers: { name: 'Bobby', thing: 'Blorp' } });
    expect(h.room.phase.kind).toBe('vote');
    expect(() => h.act('A', { type: 'reject', key: 'name:bunty', on: true })).toThrow(/own answer/);
    expect(() => h.act('A', { type: 'reject', key: 'thing:mug', on: true })).toThrow(/INVALID/); // wrong letter: no vote
    h.act('A', { type: 'reject', key: 'thing:blorp', on: true });
    h.act('B', { type: 'reject', key: 'thing:blorp', on: true });
    h.act('C', { type: 'reject', key: 'name:bilal', on: true });
    h.act('A', { type: 'reject', key: 'name:bilal', on: true });
    h.act('A', { type: 'reject', key: 'name:bilal', on: false }); // changed their mind: 1 of 2 voters
    expect(item(h, 'thing:blorp').rejects).toBe(2);
    for (const n of ['A', 'B', 'C']) h.act(n, { type: 'voteDone' });
    expect(h.room.phase.kind).toBe('results');
    // A: Bunty 10 + Bengaluru (shared) 5 + Bear (shared) 5 + Bat 10. B: Bilal 10 + 5 + 5 + Mug 0. C: Bobby 10 + Blorp 0.
    expect(h.room.game!.state.points).toEqual({ [id(h, 'A')]: 30, [id(h, 'B')]: 20, [id(h, 'C')]: 10 });
    expect([h.seat('A').score, h.seat('B').score, h.seat('C').score]).toEqual([30, 20, 10]);
    toDeadline(h);
    expect(h.room.status).toBe('break');
    expect(h.room.lastGame!.rows.find((r) => r.name === 'A')!.stats).toMatchObject({ npatValid: 4, npatUnique: 2 });
  });

  test('AC-97 at the deadline saved drafts count, an empty sheet is a missed turn, and nothing to vote on skips the vote', () => {
    const h = game({ names: ['A', 'B'] });
    h.act('A', { type: 'fill', answers: { place: 'Bhopal' } });
    toDeadline(h);
    expect(h.room.phase.kind).toBe('results');
    expect(h.room.game!.state.points).toEqual({ [id(h, 'A')]: 10 });
    expect(h.seat('B').missedTurns).toBe(1);
    expect(h.seat('A').missedTurns).toBe(0);
  });

  test('AC-97 the Movie category is only there when switched on', () => {
    expect(game().room.game!.state.cats).toEqual(['name', 'place', 'animal', 'thing']);
    const h = game({ movie: true });
    expect(h.room.game!.state.cats).toEqual(['name', 'place', 'animal', 'thing', 'movie']);
    h.act('A', { type: 'done', answers: { movie: 'Baahubali' } });
    expect(() => h.act('B', { type: 'done', answers: { colour: 'Blue' } })).not.toThrow(); // unknown keys are ignored
  });
});
