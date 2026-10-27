/* Name Place Animal Thing (R99, R100). Answers stay secret until the writing ends; Place is checked against the
 * Atlas place database, everything else is settled by a quick vote where an answer stands unless most reject it. */
import botJson from '../../../content/npat-bot.json';
import { activeSeats, award, finishGame, seatWaiting, setPhase, turnMissed } from '@/engine/core';
import { pick } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold } from '@/lib/text';
import { PLACES, lookup } from '../atlas/rules';
import { MOVIES } from '../charades/rules';
import type { GameModule } from '../types';

export type Cat = 'name' | 'place' | 'animal' | 'thing' | 'movie';
export const CATS: Cat[] = ['name', 'place', 'animal', 'thing', 'movie'];
/** Letters with plenty of answers in every category (no Q, X or Z). */
export const LETTERS = 'abcdefghijklmnoprstuvwy'.split('');
export const MAX_ANSWER = 30;
export const VOTE_MS = 20_000;
export const RESULTS_MS = 7_000;
export const UNIQUE_POINTS = 10;
export const SHARED_POINTS = 5;

const BOT = botJson as Record<string, Partial<Record<Cat, string[]>>>;

/** One distinct answer in one category, with everyone who gave it. */
export interface Item {
  key: string;
  cat: Cat;
  text: string;
  seatIds: SeatId[];
  /** ok: a known place; bad: wrong first letter; vote: stands unless most others reject it. */
  check: 'ok' | 'bad' | 'vote';
  valid?: boolean;
  rejects: number;
}

interface NpatState {
  rounds: number;
  round: number;
  writeMs: number;
  cats: Cat[];
  letter: string;
  usedLetters: string[];
  /** Each seat's answers: private until the writing ends. */
  answers: Record<SeatId, Partial<Record<Cat, string>>>;
  done: SeatId[];
  items: Item[];
  /** item key → seats rejecting it (only counts are shown). */
  rejects: Record<string, SeatId[]>;
  voteDone: SeatId[];
  points: Record<SeatId, number> | null;
  stats: Record<SeatId, { npatValid: number; npatUnique: number }>;
  /** Bots reject at most one answer per round. */
  botRejected?: SeatId[];
}

const st = (room: RoomState) => room.game!.state as NpatState;

function clean(raw: unknown, cats: Cat[]): Partial<Record<Cat, string>> {
  if (!raw || typeof raw !== 'object') throw new GameError('INVALID');
  const out: Partial<Record<Cat, string>> = {};
  for (const c of cats) {
    const v = (raw as Record<string, unknown>)[c];
    if (v === undefined) continue;
    if (typeof v !== 'string') throw new GameError('INVALID');
    out[c] = v.trim().slice(0, MAX_ANSWER);
  }
  return out;
}

/** Groups answers into distinct items and checks each one (R100). Places group by place, so Bombay = Mumbai. */
export function buildItems(answers: Record<SeatId, Partial<Record<Cat, string>>>, cats: Cat[], letter: string): Item[] {
  const byKey = new Map<string, Item>();
  for (const [seatId, a] of Object.entries(answers)) {
    for (const cat of cats) {
      const text = (a[cat] ?? '').trim();
      const f = fold(text);
      if (!f) continue;
      let key = `${cat}:${f}`;
      let check: Item['check'] = 'vote';
      if (f[0] !== letter) check = 'bad';
      else if (cat === 'place') {
        const place = lookup(text)[0];
        if (place) {
          key = `place:${place.id}`;
          check = 'ok';
        }
      }
      const item = byKey.get(key);
      if (item) item.seatIds.push(seatId);
      else byKey.set(key, { key, cat, text, seatIds: [seatId], check, rejects: 0 });
    }
  }
  return [...byKey.values()];
}

/** An answer up for a vote stands unless more than half of the other active players reject it. */
export function standsAfterVote(rejects: number, voters: number): boolean {
  return rejects * 2 <= voters;
}

/** Valid unique answers score 10, valid shared answers 5 each (R100). */
export function scoreItems(items: Item[]): Record<SeatId, number> {
  const points: Record<SeatId, number> = {};
  for (const it of items) {
    for (const id of it.seatIds) points[id] = (points[id] ?? 0) + (it.valid ? (it.seatIds.length === 1 ? UNIQUE_POINTS : SHARED_POINTS) : 0);
  }
  return points;
}

function startRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  const fresh = LETTERS.filter((l) => !s.usedLetters.includes(l));
  s.letter = pick(ctx.rng, fresh.length ? fresh : LETTERS);
  s.usedLetters.push(s.letter);
  s.answers = {};
  s.done = [];
  s.items = [];
  s.rejects = {};
  s.voteDone = [];
  s.points = null;
  s.botRejected = [];
  setPhase(room, 'write', s.writeMs, ctx);
}

function endWrite(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const seat of activeSeats(room)) {
    if (!Object.values(s.answers[seat.id] ?? {}).some((t) => fold(t ?? ''))) turnMissed(room, seat.id, ctx);
  }
  s.items = buildItems(s.answers, s.cats, s.letter);
  if (s.items.some((i) => i.check === 'vote')) setPhase(room, 'vote', ctx.testMode ? 8_000 : VOTE_MS, ctx);
  else score(room, ctx);
}

function voters(room: RoomState, item: Item): number {
  return activeSeats(room).filter((x) => !item.seatIds.includes(x.id)).length;
}

function score(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const it of s.items) {
    it.rejects = s.rejects[it.key]?.length ?? 0;
    it.valid = it.check === 'ok' || (it.check === 'vote' && standsAfterVote(it.rejects, voters(room, it)));
  }
  s.points = scoreItems(s.items);
  for (const [id, p] of Object.entries(s.points)) {
    award(room, { seatId: id }, p, `npat round ${s.round}`);
    const stat = (s.stats[id] ??= { npatValid: 0, npatUnique: 0 });
    for (const it of s.items) {
      if (!it.valid || !it.seatIds.includes(id)) continue;
      stat.npatValid += 1;
      if (it.seatIds.length === 1) stat.npatUnique += 1;
    }
  }
  setPhase(room, 'results', ctx.testMode ? 8_000 : RESULTS_MS, ctx);
}

function allIn(room: RoomState, list: SeatId[]) {
  return activeSeats(room).every((x) => list.includes(x.id));
}

function botAnswers(s: NpatState, ctx: Ctx): Partial<Record<Cat, string>> {
  const out: Partial<Record<Cat, string>> = {};
  for (const cat of s.cats) {
    if (ctx.rng() < 0.2) continue; // bots blank sometimes, like people
    if (cat === 'place') {
      const options = PLACES.filter((p) => p.kind !== 'capital' && fold(p.name)[0] === s.letter);
      if (options.length) out.place = pick(ctx.rng, options).name.slice(0, MAX_ANSWER);
    } else if (cat === 'movie') {
      const options = MOVIES.filter((m) => fold(m.title)[0] === s.letter && m.title.length <= MAX_ANSWER);
      if (options.length) out.movie = pick(ctx.rng, options).title;
    } else {
      const options = BOT[s.letter]?.[cat] ?? [];
      if (options.length) out[cat] = pick(ctx.rng, options);
    }
  }
  return out;
}

export const npat: GameModule = {
  id: 'npat',
  start(room, ctx) {
    const set = room.game!.settings as { rounds: number; seconds: number; movie: boolean };
    room.game!.state = {
      rounds: set.rounds,
      round: 1,
      writeMs: set.seconds * 1000,
      cats: CATS.filter((c) => c !== 'movie' || set.movie),
      letter: 'a',
      usedLetters: [],
      answers: {},
      done: [],
      items: [],
      rejects: {},
      voteDone: [],
      points: null,
      stats: {},
    } satisfies NpatState;
    startRound(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    switch (action.type) {
      case 'fill':
      case 'done': {
        if (room.phase.kind !== 'write') throw new GameError('WRONG_PHASE');
        if (s.done.includes(seat.id)) throw new GameError('INVALID', 'Already locked in');
        const answers = action.answers === undefined && action.type === 'done' ? {} : clean(action.answers, s.cats);
        s.answers[seat.id] = { ...(s.answers[seat.id] ?? {}), ...answers };
        if (action.type === 'done') {
          s.done.push(seat.id);
          if (allIn(room, s.done)) endWrite(room, ctx);
        }
        return;
      }
      case 'reject': {
        if (room.phase.kind !== 'vote') throw new GameError('WRONG_PHASE');
        const item = s.items.find((i) => i.key === action.key);
        if (!item || item.check !== 'vote') throw new GameError('INVALID');
        if (item.seatIds.includes(seat.id)) throw new GameError('INVALID', 'You can’t vote on your own answer');
        if (s.voteDone.includes(seat.id)) throw new GameError('INVALID', 'Already done');
        const list = (s.rejects[item.key] ??= []).filter((id) => id !== seat.id);
        s.rejects[item.key] = action.on === false ? list : [...list, seat.id];
        item.rejects = s.rejects[item.key].length;
        return;
      }
      case 'voteDone':
        if (room.phase.kind !== 'vote') throw new GameError('WRONG_PHASE');
        if (!s.voteDone.includes(seat.id)) s.voteDone.push(seat.id);
        if (allIn(room, s.voteDone)) score(room, ctx);
        return;
      default:
        throw new GameError('INVALID');
    }
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'write') return endWrite(room, ctx);
    if (room.phase.kind === 'vote') return score(room, ctx);
    if (room.phase.kind === 'results') {
      if (s.round >= s.rounds) return finishGame(room, ctx, s.stats);
      s.round += 1;
      return startRound(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    const writing = room.phase.kind === 'write';
    return {
      round: s.round,
      rounds: s.rounds,
      letter: s.letter,
      cats: s.cats,
      doneIds: s.done,
      // Answers exist in the public view only once the writing is over (R34).
      items: writing ? [] : s.items.map(({ key, cat, text, seatIds, check, valid, rejects }) => ({ key, cat, text, seatIds, check, valid: valid ?? null, rejects })),
      voteDoneIds: s.voteDone,
      points: s.points,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const kind = room.phase.kind;
    const mustAct = (kind === 'write' && !s.done.includes(seat.id)) || (kind === 'vote' && !s.voteDone.includes(seat.id));
    return {
      mustAct,
      mine: s.answers[seat.id] ?? {},
      done: s.done.includes(seat.id),
      myRejects: Object.entries(s.rejects)
        .filter(([, ids]) => ids.includes(seat.id))
        .map(([k]) => k),
    };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind === 'write' && !s.done.includes(seat.id)) {
      return { delayMs: Math.round(Math.min(s.writeMs * 0.7, 3000 + ctx.rng() * 8000)), action: { type: 'done', answers: botAnswers(s, ctx) } };
    }
    if (room.phase.kind === 'vote' && !s.voteDone.includes(seat.id)) {
      const others = s.items.filter((i) => i.check === 'vote' && !i.seatIds.includes(seat.id));
      if (others.length && !s.botRejected?.includes(seat.id) && ctx.rng() < 0.15) {
        (s.botRejected ??= []).push(seat.id);
        return { delayMs: 1500, action: { type: 'reject', key: pick(ctx.rng, others).key, on: true } };
      }
      return { delayMs: 1500 + Math.round(ctx.rng() * 2500), action: { type: 'voteDone' } };
    }
    return null;
  },
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    delete s.answers[seatId];
    if (room.phase.kind === 'write' && allIn(room, s.done)) endWrite(room, ctx);
    else if (room.phase.kind === 'vote' && allIn(room, s.voteDone)) score(room, ctx);
  },
  stats(room) {
    return st(room).stats;
  },
};
