import { describe, expect, test } from 'vitest';
import { answerKey, isCorrect, isPlace, placesOf, pointsFor, PUZZLES, selectPuzzles, type Puzzle } from '@/games/emoji/rules';
import { privateView, publicView } from '@/engine/room';
import { seededRng } from '@/engine/rng';
import { harness, startQueue, touchAll, type Harness } from '../../helpers/engine';

const byAnswer = (a: string) => PUZZLES.find((p) => p.answer === a)!;
// Regional-indicator pairs, 🏳 🏴 (and their pirate/rainbow/tag sequences), 🚩 and 🎌.
const FLAG = /[\u{1F1E6}-\u{1F1FF}]|\u{1F3F3}|\u{1F3F4}|\u{1F6A9}|\u{1F38C}/u;

describe('Emoji Decode content', () => {
  test('AC-99 at least 200 puzzles with at least 50 places, unique ids and unique answers per category', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(200);
    expect(PUZZLES.filter(isPlace).length).toBeGreaterThanOrEqual(50);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    for (const cat of ['bollywood', 'hollywood', 'country', 'city_india', 'city_world']) {
      const answers = PUZZLES.filter((p) => p.category === cat).map((p) => answerKey(p.answer));
      expect(answers.length, cat).toBeGreaterThanOrEqual(15);
      expect(new Set(answers).size, `${cat} duplicates`).toBe(answers.length);
    }
    expect(new Set(PUZZLES.map((p) => p.emoji)).size).toBe(PUZZLES.length);
  });

  test('AC-99 clues are emoji only: no letters, digits only as keycaps, and no flags anywhere', () => {
    for (const p of PUZZLES) {
      expect(p.emoji.trim().length, p.id).toBeGreaterThan(0);
      expect(p.emoji, `${p.id} has letters`).not.toMatch(/[A-Za-z]/);
      expect(p.emoji.replace(/[0-9]️⃣/g, ''), `${p.id} has a bare digit`).not.toMatch(/[0-9]/);
      expect(p.emoji, `${p.id} uses a flag`).not.toMatch(FLAG);
      // The answer is never spelled out by the clue.
      expect(p.emoji.toLowerCase()).not.toContain(p.answer.toLowerCase());
    }
  });

  test('AC-99 every place answer is in the Atlas place database, as the right kind of place (world cities in their own country)', () => {
    for (const p of PUZZLES.filter((x) => x.category === 'city_world')) expect(p.country, p.answer).toMatch(/^[A-Z]{2}$/);
    for (const p of PUZZLES.filter(isPlace)) {
      const places = placesOf(p);
      expect(places.length, `${p.id} ${p.answer}`).toBeGreaterThan(0);
      for (const pl of places) {
        if (p.category === 'country') expect(pl.kind).toBe('country');
        else expect(pl.inIndia, p.answer).toBe(p.category === 'city_india');
        if (p.country) expect(pl.country, p.answer).toBe(p.country);
      }
    }
  });
});

describe('Emoji Decode matching', () => {
  test('AC-100 places accept their other names from the Atlas database (Bombay, Bangalore, Calcutta, Peking)', () => {
    expect(isCorrect(byAnswer('Mumbai'), 'Bombay')).toBe(true);
    expect(isCorrect(byAnswer('Bengaluru'), 'bangalore')).toBe(true);
    expect(isCorrect(byAnswer('Kolkata'), 'Calcutta')).toBe(true);
    expect(isCorrect(byAnswer('Beijing'), 'Peking')).toBe(true);
    expect(isCorrect(byAnswer('Mumbai'), 'Delhi')).toBe(false);
    expect(isCorrect(byAnswer('The Netherlands'), 'Holland')).toBe(true);
    expect(isCorrect(byAnswer('Darjeeling'), 'Darjiling')).toBe(true);
    // A same-named place elsewhere doesn't lend its other names: Paris, Texas is not Paris.
    expect(placesOf(byAnswer('Paris')).every((pl) => pl.country === 'FR')).toBe(true);
  });

  test('AC-100 movie answers ignore case, spacing, punctuation and a leading "The", allow alternates and small typos in long titles', () => {
    expect(isCorrect(byAnswer('The Matrix'), 'matrix')).toBe(true);
    expect(isCorrect(byAnswer('Mission: Impossible'), 'mission impossible')).toBe(true);
    expect(isCorrect(byAnswer('Dilwale Dulhania Le Jayenge'), 'ddlj')).toBe(true);
    expect(isCorrect(byAnswer('Titanic'), 'Titanc')).toBe(true);
    expect(isCorrect(byAnswer('Kabhi Khushi Kabhie Gham'), 'kabhi kushi kabhi gham')).toBe(true);
    expect(isCorrect(byAnswer('Up'), 'Upp')).toBe(false); // short answers must be exact
    expect(isCorrect(byAnswer('Sholay'), 'Shaan')).toBe(false);
    expect(isCorrect(byAnswer('Sholay'), '')).toBe(false);
  });

  test('AC-100 points: 1000 at once, 500 at the deadline', () => {
    expect(pointsFor(0, 30_000)).toBe(1000);
    expect(pointsFor(15_000, 30_000)).toBe(750);
    expect(pointsFor(30_000, 30_000)).toBe(500);
  });

  test('AC-100 puzzles come from the chosen categories and never repeat in a room until the pool runs out', () => {
    const rng = seededRng('emoji');
    const places = selectPuzzles(10, ['countries', 'cities'], new Set(), rng);
    for (const id of places) expect(isPlace(PUZZLES.find((p) => p.id === id)!)).toBe(true);
    const bolly = PUZZLES.filter((p) => p.category === 'bollywood').map((p) => p.id);
    const used = new Set(bolly.slice(0, bolly.length - 3));
    const next = selectPuzzles(5, ['bollywood'], used, rng);
    expect(next.slice(0, 3).every((id) => !used.has(id))).toBe(true);
    expect(next).toHaveLength(5);
  });
});

function game(names = ['A', 'B', 'C']): Harness {
  const h = harness(names, { seed: 'emoji-flow' });
  startQueue(h, [{ gameId: 'emoji', settings: { rounds: 2, seconds: 30, categories: ['bollywood', 'hollywood', 'countries', 'cities'] } }]);
  return h;
}
const current = (h: Harness): Puzzle => PUZZLES.find((p) => p.id === h.room.game!.state.ids[h.room.game!.state.idx])!;

describe('Emoji Decode rounds', () => {
  test('AC-100 the answer is secret until the reveal; wrong guesses are private; a correct one scores with speed and can’t repeat', () => {
    const h = game();
    const p = current(h);
    const pub = JSON.stringify(publicView(h.room, {}, h.clock.now)).toLowerCase();
    for (const a of [p.answer, ...p.alt]) expect(pub).not.toContain(JSON.stringify(a.toLowerCase()));
    for (const s of h.room.seats) expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: s.id })).toLowerCase()).not.toContain(p.answer.toLowerCase());
    const wrong = h.act('A', { type: 'guess', text: 'definitely not it' });
    expect(wrong.private).toEqual({ correct: false });
    expect(h.seat('A').score).toBe(0);
    h.clock.advance(6000);
    const right = h.act('A', { type: 'guess', text: p.answer.toUpperCase() });
    expect(right.private).toEqual({ correct: true, points: 900 });
    expect(h.seat('A').score).toBe(900);
    expect(() => h.act('A', { type: 'guess', text: p.answer })).toThrow(/already got it/);
    expect(JSON.stringify(publicView(h.room, {}, h.clock.now))).not.toContain(p.answer);
  });

  test('AC-100 the puzzle ends early when everyone has solved it; no attempt is a missed turn; the game ends after the last puzzle', () => {
    const h = game();
    const p = current(h);
    for (const n of ['A', 'B', 'C']) h.act(n, { type: 'guess', text: p.answer });
    expect(h.room.phase.kind).toBe('reveal');
    expect(publicView(h.room, {}, h.clock.now).game!.view.answer).toBe(p.answer);
    h.clock.advance(h.room.phase.deadline! - h.clock.now + 1);
    touchAll(h);
    h.tick();
    expect(h.room.phase.kind).toBe('puzzle');
    expect(current(h).id).not.toBe(p.id);
    h.act('A', { type: 'guess', text: 'nope' });
    h.clock.advance(h.room.phase.deadline! - h.clock.now + 1);
    touchAll(h);
    h.tick();
    expect(h.room.phase.kind).toBe('reveal');
    expect(h.seat('A').missedTurns).toBe(0);
    expect(h.seat('B').missedTurns).toBe(1);
    h.clock.advance(h.room.phase.deadline! - h.clock.now + 1);
    touchAll(h);
    h.tick();
    expect(h.room.status).toBe('break');
    expect(h.room.lastGame!.rows.find((r) => r.name === 'B')!.stats).toMatchObject({ emojiSolved: 1 });
  });
});
