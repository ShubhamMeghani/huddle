/* Atlas rules (R76–R81). The place database (data/places.json) is server-only. */
import placesJson from '../../../data/places.json';
import { activeSeats, addNotice, award, finishGame, seatById, setPhase, turnMissed } from '@/engine/core';
import { pick } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold } from '@/lib/text';
import type { GameModule } from '../types';

export interface Place {
  id: string;
  name: string;
  alt: string[];
  kind: 'country' | 'capital' | 'state' | 'city';
  country: string;
  inIndia: boolean;
  capital?: string;
}
export type Variant = 'any' | 'india' | 'countries';

export const PLACES = placesJson as Place[];
const INDEX = new Map<string, Place[]>();
for (const p of PLACES) {
  for (const n of [p.name, ...p.alt]) {
    const k = fold(n);
    if (!k) continue;
    const list = INDEX.get(k) ?? [];
    if (!list.includes(p)) list.push(p);
    INDEX.set(k, list);
  }
}

export const VOTE_MS = 10_000;

export function inVariant(p: Place, v: Variant): boolean {
  return v === 'any' || (v === 'india' ? p.inIndia : p.kind === 'country');
}

/** All database places matching a typed name (case, accent, space and punctuation insensitive). */
export function lookup(text: string): Place[] {
  return INDEX.get(fold(text)) ?? [];
}

function namesOf(p: Place): string[] {
  return [p.name, ...p.alt].map(fold).filter(Boolean);
}

/** Letters available to start a place in this variant, given what has been used. */
function hasUnused(letter: string, variant: Variant, used: Set<string>, customUsed: Set<string>): boolean {
  for (const p of PLACES) {
    if (!inVariant(p, variant) || used.has(p.id)) continue;
    if (namesOf(p).some((n) => n[0] === letter && !customUsed.has(n))) return true;
  }
  return false;
}

/** Required next letter: the last letter of the name, or the one before it when no unused place starts with it (R78). */
export function nextLetter(name: string, variant: Variant, used: Set<string>, customUsed: Set<string> = new Set()): string {
  const letters = fold(name).replace(/[^a-z]/g, '');
  for (let i = letters.length - 1; i >= 0; i--) if (hasUnused(letters[i], variant, used, customUsed)) return letters[i];
  return letters[letters.length - 1] ?? 'a';
}

export type Check = { ok: true; place: Place } | { ok: false; reason: 'unknown' | 'letter' | 'used' | 'variant' };

/** Validates a submission against the database, letter, variant and used places (R77, R81). */
export function checkPlace(text: string, letter: string, variant: Variant, used: Set<string>): Check {
  const matches = lookup(text);
  if (!matches.length) return { ok: false, reason: 'unknown' };
  if (fold(text)[0] !== letter) return { ok: false, reason: 'letter' };
  const fits = matches.filter((p) => inVariant(p, variant));
  if (!fits.length) return { ok: false, reason: 'variant' };
  const fresh = fits.find((p) => !used.has(p.id));
  if (!fresh) return { ok: false, reason: 'used' };
  return { ok: true, place: fresh };
}

/** Accept vote: a majority of the votes cast accepts; a tie or no votes rejects (R79). */
export function voteAccepts(votes: boolean[]): boolean {
  const yes = votes.filter(Boolean).length;
  return yes > votes.length - yes;
}

interface AtlasState {
  variant: Variant;
  turnMs: number;
  order: SeatId[];
  lives: Record<SeatId, number>;
  out: SeatId[];
  turnIdx: number;
  letter: string;
  used: string[];
  customUsed: string[];
  chain: { seatId: SeatId; name: string; custom: boolean }[];
  vote: { name: string; proposer: SeatId; votes: Record<SeatId, boolean>; remainingMs: number } | null;
  winner: SeatId | null;
  stats: Record<SeatId, { placesNamed: number }>;
}

const st = (room: RoomState) => room.game!.state as AtlasState;
const REASONS: Record<string, string> = {
  letter: 'That doesn’t start with the right letter',
  used: 'Already used in this game',
  variant: 'Not allowed in this variant',
};

function alive(s: AtlasState) {
  return s.order.filter((id) => !s.out.includes(id));
}

function nextTurn(room: RoomState, ctx: Ctx, advance = true) {
  const s = st(room);
  const left = alive(s).filter((id) => seatById(room, id)?.status === 'seated');
  if (left.length <= 1) return endGame(room, ctx, left[0] ?? null);
  for (let i = 0; i < s.order.length; i++) {
    if (advance) s.turnIdx = (s.turnIdx + 1) % s.order.length;
    advance = true;
    const id = s.order[s.turnIdx];
    if (!s.out.includes(id) && seatById(room, id)?.status === 'seated') {
      setPhase(room, 'turn', s.turnMs, ctx, id);
      return;
    }
  }
}

function endGame(room: RoomState, ctx: Ctx, winner: SeatId | null) {
  const s = st(room);
  s.winner = winner;
  if (winner) award(room, { seatId: winner }, 50, 'last one standing');
  finishGame(room, ctx, s.stats);
}

function accept(room: RoomState, ctx: Ctx, seatId: SeatId, name: string, placeId: string | null) {
  const s = st(room);
  if (placeId) s.used.push(placeId);
  else s.customUsed.push(fold(name));
  s.chain.push({ seatId, name, custom: !placeId });
  if (s.chain.length > 60) s.chain.shift();
  (s.stats[seatId] ??= { placesNamed: 0 }).placesNamed += 1;
  award(room, { seatId }, 10, 'place');
  s.letter = nextLetter(name, s.variant, new Set(s.used), new Set(s.customUsed));
  nextTurn(room, ctx);
}

function closeVote(room: RoomState, ctx: Ctx) {
  const s = st(room);
  const v = s.vote!;
  const accepted = voteAccepts(Object.values(v.votes));
  ctx.effects.push({ type: 'placeSuggestion', name: fold(v.name), accepted });
  s.vote = null;
  if (accepted) {
    addNotice(room, `“${v.name}” was accepted`, ctx);
    return accept(room, ctx, v.proposer, v.name, null);
  }
  addNotice(room, `“${v.name}” was rejected`, ctx);
  // Back to the same player's turn with the time they had left (the timer was paused during the vote).
  setPhase(room, 'turn', v.remainingMs, ctx, v.proposer);
}

export const atlas: GameModule = {
  id: 'atlas',
  chatActions: ['submit'],
  start(room, ctx) {
    const set = room.game!.settings as { seconds: number; lives: number; variant: Variant };
    const order = room.seats.filter((x) => x.status === 'seated').map((x) => x.id);
    const starts = 'abcdefghiklmnoprstuvw'.split('').filter((l) => hasUnused(l, set.variant, new Set(), new Set()));
    room.game!.state = {
      variant: set.variant,
      turnMs: set.seconds * 1000,
      order,
      lives: Object.fromEntries(order.map((id) => [id, set.lives])),
      out: [],
      turnIdx: -1,
      letter: pick(ctx.rng, starts),
      used: [],
      customUsed: [],
      chain: [],
      vote: null,
      winner: null,
      stats: {},
    } satisfies AtlasState;
    nextTurn(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    if (action.type === 'submit') {
      if (room.phase.kind !== 'turn') throw new GameError('WRONG_PHASE');
      if (room.phase.turnSeatId !== seat.id) throw new GameError('NOT_YOUR_TURN');
      const text = typeof action.text === 'string' ? action.text.trim().slice(0, 60) : '';
      if (!fold(text)) throw new GameError('INVALID');
      if (fold(text)[0] !== s.letter) throw new GameError('INVALID', `Start with ${s.letter.toUpperCase()}`);
      if (s.customUsed.includes(fold(text))) throw new GameError('INVALID', REASONS.used);
      const c = checkPlace(text, s.letter, s.variant, new Set(s.used));
      if (c.ok) return accept(room, ctx, seat.id, c.place.name, c.place.id);
      if (c.reason !== 'unknown') throw new GameError('INVALID', REASONS[c.reason]);
      // Unknown place: pause the turn and let the others vote (R79).
      s.vote = { name: text, proposer: seat.id, votes: {}, remainingMs: Math.max(1000, (room.phase.deadline ?? ctx.now) - ctx.now) };
      setPhase(room, 'vote', ctx.testMode ? 5_000 : VOTE_MS, ctx);
      if (!activeSeats(room).some((x) => x.id !== seat.id && alive(s).includes(x.id))) closeVote(room, ctx);
      return;
    }
    if (action.type === 'vote') {
      if (room.phase.kind !== 'vote' || !s.vote) throw new GameError('WRONG_PHASE');
      if (seat.id === s.vote.proposer || !alive(s).includes(seat.id)) throw new GameError('INVALID', 'You can’t vote on this one');
      if (s.vote.votes[seat.id] !== undefined) throw new GameError('INVALID', 'Already voted');
      s.vote.votes[seat.id] = Boolean(action.accept);
      const voters = activeSeats(room).filter((x) => x.id !== s.vote!.proposer && alive(s).includes(x.id));
      if (voters.every((x) => s.vote!.votes[x.id] !== undefined)) closeVote(room, ctx);
      return;
    }
    throw new GameError('INVALID');
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'vote') return closeVote(room, ctx);
    if (room.phase.kind === 'turn' && room.phase.turnSeatId) {
      const id = room.phase.turnSeatId;
      turnMissed(room, id, ctx); // AFK players keep their turns in Atlas and lose lives normally
      s.lives[id] = (s.lives[id] ?? 1) - 1;
      if (s.lives[id] <= 0) {
        s.out.push(id);
        addNotice(room, `${seatById(room, id)?.name ?? 'A player'} is out`, ctx);
      }
      return nextTurn(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    return {
      variant: s.variant,
      order: s.order,
      lives: s.lives,
      out: s.out,
      letter: s.letter,
      chain: s.chain.slice(-30),
      count: s.used.length + s.customUsed.length,
      vote: s.vote ? { name: s.vote.name, proposer: s.vote.proposer, votedIds: Object.keys(s.vote.votes) } : null,
      winner: s.winner,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const mustAct =
      (room.phase.kind === 'turn' && room.phase.turnSeatId === seat.id) ||
      (room.phase.kind === 'vote' && !!s.vote && s.vote.proposer !== seat.id && alive(s).includes(seat.id) && s.vote.votes[seat.id] === undefined);
    return { mustAct, myVote: s.vote?.votes[seat.id] ?? null };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind === 'turn' && room.phase.turnSeatId === seat.id) {
      if (ctx.rng() > 0.85) return null; // sometimes the bot blanks and runs out of time
      const used = new Set(s.used);
      const options = PLACES.filter((p) => inVariant(p, s.variant) && !used.has(p.id) && fold(p.name)[0] === s.letter && p.kind !== 'capital');
      if (!options.length) return null;
      return { delayMs: 1500 + Math.round(ctx.rng() * 2500), action: { type: 'submit', text: pick(ctx.rng, options).name } };
    }
    if (room.phase.kind === 'vote' && s.vote && s.vote.proposer !== seat.id && s.vote.votes[seat.id] === undefined && alive(s).includes(seat.id)) {
      return { delayMs: 1500, action: { type: 'vote', accept: ctx.rng() < 0.5 } };
    }
    return null;
  },
  shiftTimes() {},
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    if (!s.out.includes(seatId)) s.out.push(seatId);
    if (room.phase.kind === 'turn' && room.phase.turnSeatId === seatId) nextTurn(room, ctx);
    else if (alive(s).length <= 1) endGame(room, ctx, alive(s)[0] ?? null);
  },
  stats(room) {
    return st(room).stats;
  },
};
