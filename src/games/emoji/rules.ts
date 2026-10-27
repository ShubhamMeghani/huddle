/* Emoji Decode (R101, R102): Quiz-style rounds where players type what the emoji spell. Server-only: the bank holds
 * the answers. Place answers also accept every name the Atlas place database knows (Bombay = Mumbai). */
import bankJson from '../../../content/emoji.json';
import { activeSeats, award, finishGame, seatWaiting, setPhase, turnMissed } from '@/engine/core';
import { shuffle } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold, levenshtein } from '@/lib/text';
import { lookup, type Place } from '../atlas/rules';
import type { GameModule } from '../types';

export type EmojiCategory = 'bollywood' | 'hollywood' | 'country' | 'city_india' | 'city_world';
export interface Puzzle {
  id: string;
  category: EmojiCategory;
  emoji: string;
  answer: string;
  alt: string[];
  /** World cities: the ISO country code, so a same-named place elsewhere never counts. */
  country?: string;
}

export const PUZZLES = bankJson as Puzzle[];
const BY_ID = new Map(PUZZLES.map((p) => [p.id, p]));
export const REVEAL_MS = 5_000;
/** Setting value → bank categories. */
export const CATEGORY_GROUPS: Record<string, EmojiCategory[]> = {
  bollywood: ['bollywood'],
  hollywood: ['hollywood'],
  countries: ['country'],
  cities: ['city_india', 'city_world'],
};

export const isPlace = (p: Puzzle) => p.category === 'country' || p.category.startsWith('city_');

/** The database places a place puzzle stands for: right kind, India or not for cities, and the right country. */
export function placesOf(p: Puzzle): Place[] {
  if (!isPlace(p)) return [];
  return lookup(p.answer).filter(
    (pl) =>
      (p.category === 'country' ? pl.kind === 'country' : pl.kind !== 'country' && pl.inIndia === (p.category === 'city_india')) &&
      (!p.country || pl.country === p.country),
  );
}

/** Folded answer with a leading "the" dropped, so "The Matrix" = "Matrix". */
export function answerKey(s: string): string {
  return fold(s).replace(/^the(?=.)/, '');
}

function typoAllowance(key: string): number {
  return key.length >= 10 ? 2 : key.length >= 5 ? 1 : 0;
}

/** Correct when it matches the answer or an alternate (small typos allowed in longer answers), or names the same place. */
export function isCorrect(p: Puzzle, guess: string): boolean {
  const g = answerKey(guess);
  if (!g) return false;
  for (const a of [p.answer, ...p.alt].map(answerKey)) if (levenshtein(g, a) <= typoAllowance(a)) return true;
  const ids = new Set(placesOf(p).map((pl) => pl.id));
  return ids.size > 0 && lookup(guess).some((pl) => ids.has(pl.id));
}

/** 500 for a correct answer plus up to 500 for speed, as in Quiz Clash. */
export function pointsFor(ms: number, durationMs: number): number {
  const remaining = Math.max(0, Math.min(durationMs, durationMs - ms));
  return 500 + Math.round((500 * remaining) / durationMs);
}

export function selectPuzzles(n: number, categories: string[], used: Set<string>, rng: () => number): string[] {
  const cats = new Set(categories.flatMap((c) => CATEGORY_GROUPS[c] ?? []));
  const pool = PUZZLES.filter((p) => cats.has(p.category));
  const fresh = shuffle(rng, pool.filter((p) => !used.has(p.id)));
  const stale = shuffle(rng, pool.filter((p) => used.has(p.id)));
  return [...fresh, ...stale].slice(0, n).map((p) => p.id);
}

interface EmojiState {
  ids: string[];
  idx: number;
  durationMs: number;
  /** seat → ms after the puzzle appeared when they solved it. */
  solved: Record<SeatId, number>;
  tried: SeatId[];
  stats: Record<SeatId, { emojiSolved: number; emojiTimes: number[] }>;
  /** Phase in which each bot decided to sit this puzzle out (decided once, not re-rolled every tick). */
  botPass: Record<SeatId, number>;
}

const st = (room: RoomState) => room.game!.state as EmojiState;

function startPuzzle(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  s.solved = {};
  s.tried = [];
  setPhase(room, 'puzzle', s.durationMs, ctx);
}

function reveal(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const seat of activeSeats(room)) if (!s.tried.includes(seat.id)) turnMissed(room, seat.id, ctx);
  setPhase(room, 'reveal', ctx.testMode ? 8_000 : REVEAL_MS, ctx);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2);
}

export const emoji: GameModule = {
  id: 'emoji',
  chatActions: ['guess'],
  start(room, ctx) {
    const set = room.game!.settings as { rounds: number; seconds: number; categories: string[] };
    room.memory ??= {};
    const used = new Set<string>((room.memory.emojiUsed as string[] | undefined) ?? []);
    const ids = selectPuzzles(set.rounds, set.categories, used, ctx.rng);
    if (!ids.length) throw new GameError('INVALID', 'No puzzles match those categories');
    room.memory.emojiUsed = [...new Set([...used, ...ids])];
    room.game!.state = { ids, idx: 0, durationMs: set.seconds * 1000, solved: {}, tried: [], stats: {}, botPass: {} } satisfies EmojiState;
    startPuzzle(room, ctx);
  },
  act(room, seat, action, ctx) {
    if (action.type !== 'guess') throw new GameError('INVALID');
    const s = st(room);
    if (room.phase.kind !== 'puzzle') throw new GameError('WRONG_PHASE');
    const text = typeof action.text === 'string' ? action.text.trim().slice(0, 60) : '';
    if (!fold(text)) throw new GameError('INVALID');
    if (s.solved[seat.id] !== undefined) throw new GameError('INVALID', 'You already got it');
    if (!s.tried.includes(seat.id)) s.tried.push(seat.id);
    const p = BY_ID.get(s.ids[s.idx])!;
    if (!isCorrect(p, text)) {
      ctx.private = { correct: false };
      return;
    }
    const ms = ctx.now - room.phase.startedAt;
    s.solved[seat.id] = ms;
    const pts = pointsFor(ms, s.durationMs);
    award(room, { seatId: seat.id }, pts, `emoji ${s.idx + 1}`);
    const stat = (s.stats[seat.id] ??= { emojiSolved: 0, emojiTimes: [] });
    stat.emojiSolved += 1;
    stat.emojiTimes.push(ms);
    ctx.private = { correct: true, points: pts };
    if (activeSeats(room).every((x) => s.solved[x.id] !== undefined)) reveal(room, ctx);
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'puzzle') return reveal(room, ctx);
    if (room.phase.kind === 'reveal') {
      if (s.idx + 1 >= s.ids.length) return finishGame(room, ctx, emoji.stats!(room));
      s.idx += 1;
      return startPuzzle(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    const p = BY_ID.get(s.ids[s.idx])!;
    const revealing = room.phase.kind === 'reveal';
    return {
      idx: s.idx,
      total: s.ids.length,
      emoji: p.emoji,
      category: p.category,
      solved: Object.entries(s.solved).map(([seatId, ms]) => ({ seatId, ms })),
      // The answer only exists in the view during the reveal (R34).
      answer: revealing ? p.answer : null,
      points: revealing ? Object.fromEntries(Object.entries(s.solved).map(([id, ms]) => [id, pointsFor(ms, s.durationMs)])) : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const solved = s.solved[seat.id] !== undefined;
    return { mustAct: room.phase.kind === 'puzzle' && !solved, solved };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind !== 'puzzle' || s.solved[seat.id] !== undefined || s.botPass[seat.id] === room.phase.id) return null;
    if (ctx.rng() > 0.6) {
      s.botPass[seat.id] = room.phase.id;
      return null;
    }
    const p = BY_ID.get(s.ids[s.idx])!;
    return { delayMs: Math.round(Math.min(s.durationMs * 0.8, 2500 + ctx.rng() * 9000)), action: { type: 'guess', text: p.answer } };
  },
  stats(room) {
    return Object.fromEntries(Object.entries(st(room).stats).map(([id, v]) => [id, { emojiSolved: v.emojiSolved, emojiMedianMs: median(v.emojiTimes) }]));
  },
};
