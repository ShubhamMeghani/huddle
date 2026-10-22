import { describe, expect, test } from 'vitest';
import { guessMatches, validClue } from '@/games/imposter/rules';
import { privateView, publicView } from '@/engine/room';
import { harness, startQueue } from '../../helpers/engine';

const settings = (extra: Record<string, unknown> = {}) => ({
  rounds: 1,
  clueRounds: 1,
  clueSeconds: 30,
  discussSeconds: 60,
  voteSeconds: 30,
  twoImposters: false,
  imposterKnows: false,
  ...extra,
});
const queue = (extra: Record<string, unknown> = {}) => [{ gameId: 'imposter' as const, settings: settings(extra) }];
type S = { imposters: string[]; order: string[]; crewWord: string; imposterWord: string; players: string[] };
const ist = (h: ReturnType<typeof harness>) => h.room.game!.state as S;
const NAMES = ['A', 'B', 'C', 'D', 'E'];

/** Everyone gives a clue, then everyone taps Ready. */
function toVote(h: ReturnType<typeof harness>) {
  for (const id of ist(h).order) h.act(h.room.seats.find((x) => x.id === id)!, { type: 'clue', text: 'something' });
  expect(h.room.phase.kind).toBe('discuss');
  for (const s of h.room.seats) h.act(s, { type: 'ready' });
  expect(h.room.phase.kind).toBe('vote');
}

describe('Imposter rules', () => {
  test('AC-72 one imposter; two with 8+ players when enabled; each player sees only their own word', () => {
    const h = harness(NAMES);
    startQueue(h, queue());
    expect(ist(h).imposters).toHaveLength(1);
    const words = h.room.seats.map((s) => privateView(h.room, { kind: 'player', seatId: s.id }).game!.word);
    expect(new Set(words).size).toBe(2);
    expect(words.filter((w) => w === ist(h).imposterWord)).toHaveLength(1);
    expect(privateView(h.room, { kind: 'player', seatId: ist(h).imposters[0] }).game!.isImposter).toBeNull(); // not told by default (Q2)
    const pub = JSON.stringify(publicView(h.room, {}, h.clock.now));
    expect(pub).not.toContain(ist(h).crewWord);
    expect(pub).not.toContain(ist(h).imposterWord);

    const big = harness(['1', '2', '3', '4', '5', '6', '7', '8']);
    startQueue(big, queue({ twoImposters: true }));
    expect(ist(big).imposters).toHaveLength(2);
  });

  test('AC-72 clue validation: one word, letters only, not containing your own word', () => {
    expect(validClue('masala', 'chai')).toBe(true);
    expect(validClue('two words', 'chai')).toBe(false);
    expect(validClue('chaiwala', 'chai')).toBe(false);
    expect(validClue('rickshaw', 'auto rickshaw')).toBe(false);
    expect(validClue('x1', 'chai')).toBe(false);
  });

  test('AC-72 votes exclude self; a tie triggers one revote; a second tie means the imposter survives', () => {
    const h = harness(['A', 'B', 'C', 'D']);
    startQueue(h, queue());
    toVote(h);
    const [A, B, C, D] = h.room.seats;
    expect(() => h.act(A, { type: 'vote', seatId: A.id })).toThrow(/yourself/);
    h.act(A, { type: 'vote', seatId: B.id });
    h.act(B, { type: 'vote', seatId: A.id });
    h.act(C, { type: 'vote', seatId: B.id });
    h.act(D, { type: 'vote', seatId: A.id });
    expect(h.room.phase.kind).toBe('revote');
    expect(() => h.act(A, { type: 'vote', seatId: C.id })).toThrow(/tied/);
    h.act(A, { type: 'vote', seatId: B.id });
    h.act(B, { type: 'vote', seatId: A.id });
    h.act(C, { type: 'vote', seatId: B.id });
    h.act(D, { type: 'vote', seatId: A.id });
    expect(h.room.phase.kind).toBe('reveal');
    const imp = ist(h).imposters[0];
    expect(h.room.seats.find((s) => s.id === imp)!.score).toBe(300);
  });

  test('AC-72 a caught imposter who guesses the crew word (one typo allowed for 5+ letters) steals; scoring', () => {
    expect(guessMatches('Biryanu', 'biryani')).toBe(true);
    expect(guessMatches('chia', 'chai')).toBe(false); // 4 letters: exact only
    expect(guessMatches('', 'chai')).toBe(false);

    const h = harness(NAMES);
    startQueue(h, queue());
    toVote(h);
    const imp = ist(h).imposters[0];
    const crew = h.room.seats.filter((s) => s.id !== imp);
    for (const s of crew) h.act(s, { type: 'vote', seatId: imp });
    h.act(h.room.seats.find((s) => s.id === imp)!, { type: 'vote', seatId: crew[0].id });
    expect(h.room.phase.kind).toBe('guess');
    h.act(h.room.seats.find((s) => s.id === imp)!, { type: 'guess', text: ist(h).crewWord.toUpperCase() });
    expect(h.room.phase.kind).toBe('reveal');
    expect(h.room.seats.find((s) => s.id === imp)!.score).toBe(200);
    for (const s of crew) expect(s.score).toBe(50); // voted correctly, but the imposter stole the win
  });

  test('AC-72 crew win: +100 each, +50 for voting the imposter', () => {
    const h = harness(NAMES);
    startQueue(h, queue());
    toVote(h);
    const imp = ist(h).imposters[0];
    const crew = h.room.seats.filter((s) => s.id !== imp);
    h.act(crew[0], { type: 'vote', seatId: imp });
    h.act(crew[1], { type: 'vote', seatId: imp });
    h.act(crew[2], { type: 'vote', seatId: imp });
    h.act(crew[3], { type: 'vote', seatId: crew[0].id });
    h.act(h.room.seats.find((s) => s.id === imp)!, { type: 'vote', seatId: crew[0].id });
    h.act(h.room.seats.find((s) => s.id === imp)!, { type: 'guess', text: 'definitely wrong' });
    expect(crew.map((s) => s.score)).toEqual([150, 150, 150, 100]);
    expect(h.room.seats.find((s) => s.id === imp)!.score).toBe(0);
  });
});
