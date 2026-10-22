/* Imposter rules (R82–R87). Words and the imposter's identity stay server-side until the reveal. */
import pairsJson from '../../../content/imposter-pairs.json';
import { activeSeats, award, finishGame, seatById, seatWaiting, setPhase, skipIfAfk, turnMissed } from '@/engine/core';
import { pick, shuffle } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold, levenshtein } from '@/lib/text';
import type { GameModule } from '../types';

export interface Pair {
  id: string;
  category: string;
  a: string;
  b: string;
  hintsA: string[];
  hintsB: string[];
}
export const PAIRS = pairsJson as Pair[];

export const REVOTE_MS = 20_000;
export const GUESS_MS = 30_000;
export const REVEAL_MS = 7_000;

export interface ImposterSettings {
  rounds: number;
  clueRounds: number;
  clueSeconds: number;
  discussSeconds: number;
  voteSeconds: number;
  twoImposters: boolean;
  imposterKnows: boolean;
}

interface ImposterState {
  set: ImposterSettings;
  round: number;
  pairId: string;
  crewWord: string;
  imposterWord: string;
  imposters: SeatId[];
  players: SeatId[];
  order: SeatId[];
  clueTurn: number;
  clues: { seatId: SeatId; round: number; text: string }[];
  ready: SeatId[];
  votes: Record<SeatId, SeatId>;
  revoteCandidates: SeatId[] | null;
  tally: Record<SeatId, number> | null;
  accused: SeatId | null;
  guess: string | null;
  outcome: 'crew' | 'imposter' | 'steal' | null;
  usedPairs: string[];
  stats: Record<SeatId, { imposterRounds: number; imposterWins: number; votesReceived: number }>;
}

const st = (room: RoomState) => room.game!.state as ImposterState;
const ms = (s: ImposterState, key: 'clueSeconds' | 'discussSeconds' | 'voteSeconds') => s.set[key] * 1000;

/** A clue is one word (letters only, ≤ 20) and may not contain the player's own word (R84). */
export function validClue(text: string, ownWord: string): boolean {
  if (!/^\p{L}{1,20}$/u.test(text)) return false;
  const c = fold(text);
  const parts = ownWord.split(/[\s-]+/).map(fold).filter((p) => p.length >= 3);
  return !c.includes(fold(ownWord)) && !parts.some((p) => c.includes(p));
}

/** The caught imposter's guess matches if equal after folding, or within 1 edit for 5+ letter words (R87). */
export function guessMatches(guess: string, word: string): boolean {
  const g = fold(guess);
  const w = fold(word);
  if (!g) return false;
  return g === w || (w.length >= 5 && levenshtein(g, w) <= 1);
}

function wordOf(s: ImposterState, seatId: SeatId): string {
  return s.imposters.includes(seatId) ? s.imposterWord : s.crewWord;
}

function stat(s: ImposterState, id: SeatId) {
  return (s.stats[id] ??= { imposterRounds: 0, imposterWins: 0, votesReceived: 0 });
}

function beginRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  s.players = activeSeats(room).map((x) => x.id);
  if (s.players.length < 4) s.players = room.seats.filter((x) => x.status === 'seated').map((x) => x.id);
  const fresh = PAIRS.filter((p) => !s.usedPairs.includes(p.id));
  const pair = pick(ctx.rng, fresh.length ? fresh : PAIRS);
  s.usedPairs.push(pair.id);
  const flip = ctx.rng() < 0.5;
  s.pairId = pair.id;
  s.crewWord = flip ? pair.b : pair.a;
  s.imposterWord = flip ? pair.a : pair.b;
  const count = s.set.twoImposters && s.players.length >= 8 ? 2 : 1;
  s.imposters = shuffle(ctx.rng, s.players).slice(0, count);
  for (const id of s.imposters) stat(s, id).imposterRounds += 1;
  s.order = shuffle(ctx.rng, s.players);
  s.clueTurn = -1;
  s.clues = [];
  s.ready = [];
  s.votes = {};
  s.revoteCandidates = null;
  s.tally = null;
  s.accused = null;
  s.guess = null;
  s.outcome = null;
  nextClue(room, ctx);
}

function nextClue(room: RoomState, ctx: Ctx) {
  const s = st(room);
  const total = s.order.length * s.set.clueRounds;
  for (;;) {
    s.clueTurn += 1;
    if (s.clueTurn >= total) {
      s.ready = [];
      return setPhase(room, 'discuss', ms(s, 'discussSeconds'), ctx);
    }
    const id = s.order[s.clueTurn % s.order.length];
    if (seatById(room, id)?.status !== 'seated' || skipIfAfk(room, id)) continue;
    return setPhase(room, 'clue', ms(s, 'clueSeconds'), ctx, id);
  }
}

function voters(room: RoomState, s: ImposterState) {
  return activeSeats(room).filter((x) => s.players.includes(x.id));
}

function startVote(room: RoomState, ctx: Ctx, candidates: SeatId[] | null) {
  const s = st(room);
  s.votes = {};
  s.revoteCandidates = candidates;
  setPhase(room, candidates ? 'revote' : 'vote', candidates ? (ctx.testMode ? 10_000 : REVOTE_MS) : ms(s, 'voteSeconds'), ctx);
}

function closeVote(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const v of voters(room, s)) if (!s.votes[v.id]) turnMissed(room, v.id, ctx);
  const tally: Record<SeatId, number> = {};
  for (const target of Object.values(s.votes)) tally[target] = (tally[target] ?? 0) + 1;
  s.tally = tally;
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter((k) => tally[k] === max);
  if (max === 0 || top.length > 1) {
    if (room.phase.kind === 'vote' && top.length > 1) return startVote(room, ctx, top); // one revote among the tied
    return resolve(room, ctx, null); // tie again (or nobody voted): the imposter survives (R86)
  }
  s.accused = top[0];
  if (s.imposters.includes(top[0])) return setPhase(room, 'guess', ctx.testMode ? 15_000 : GUESS_MS, ctx, top[0]);
  return resolve(room, ctx, null);
}

function resolve(room: RoomState, ctx: Ctx, guess: string | null) {
  const s = st(room);
  const caught = s.accused !== null && s.imposters.includes(s.accused);
  s.guess = guess;
  if (caught && guess !== null && guessMatches(guess, s.crewWord)) s.outcome = 'steal';
  else s.outcome = caught ? 'crew' : 'imposter';
  const crew = s.players.filter((id) => !s.imposters.includes(id));
  if (s.outcome === 'crew') for (const id of crew) award(room, { seatId: id }, 100, 'crew win');
  if (s.outcome === 'imposter') for (const id of s.imposters) award(room, { seatId: id }, 300, 'imposter survives');
  if (s.outcome === 'steal' && s.accused) award(room, { seatId: s.accused }, 200, 'imposter steal');
  if (s.outcome !== 'crew') for (const id of s.imposters) stat(s, id).imposterWins += 1;
  // +50 to crew who voted for an imposter in the deciding vote.
  for (const [voter, target] of Object.entries(s.votes)) if (crew.includes(voter) && s.imposters.includes(target)) award(room, { seatId: voter }, 50, 'good vote');
  for (const [target, n] of Object.entries(s.tally ?? {})) stat(s, target).votesReceived += n;
  setPhase(room, 'reveal', ctx.testMode ? 10_000 : REVEAL_MS, ctx);
}

export const imposter: GameModule = {
  id: 'imposter',
  chatActions: ['clue'],
  start(room, ctx) {
    room.game!.state = {
      set: room.game!.settings as unknown as ImposterSettings,
      round: 1,
      usedPairs: ((room.memory ??= {}).imposterUsed as string[] | undefined) ?? [],
      stats: {},
    } as unknown as ImposterState;
    beginRound(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    if (!s.players.includes(seat.id)) throw new GameError('NOT_SEATED');
    switch (action.type) {
      case 'clue': {
        if (room.phase.kind !== 'clue') throw new GameError('WRONG_PHASE');
        if (room.phase.turnSeatId !== seat.id) throw new GameError('NOT_YOUR_TURN');
        const text = typeof action.text === 'string' ? action.text.trim() : '';
        if (!validClue(text, wordOf(s, seat.id))) throw new GameError('INVALID', 'One word, letters only, and not your own word');
        s.clues.push({ seatId: seat.id, round: Math.floor(s.clueTurn / s.order.length) + 1, text });
        return nextClue(room, ctx);
      }
      case 'ready': {
        if (room.phase.kind !== 'discuss') throw new GameError('WRONG_PHASE');
        if (!s.ready.includes(seat.id)) s.ready.push(seat.id);
        if (voters(room, s).every((v) => s.ready.includes(v.id))) startVote(room, ctx, null);
        return;
      }
      case 'vote': {
        if (room.phase.kind !== 'vote' && room.phase.kind !== 'revote') throw new GameError('WRONG_PHASE');
        const target = String(action.seatId ?? '');
        if (target === seat.id) throw new GameError('INVALID', 'You cannot vote for yourself');
        if (!s.players.includes(target)) throw new GameError('INVALID');
        if (s.revoteCandidates && !s.revoteCandidates.includes(target)) throw new GameError('INVALID', 'Vote for one of the tied players');
        if (s.votes[seat.id]) throw new GameError('INVALID', 'Already voted');
        s.votes[seat.id] = target;
        if (voters(room, s).every((v) => s.votes[v.id])) closeVote(room, ctx);
        return;
      }
      case 'guess': {
        if (room.phase.kind !== 'guess') throw new GameError('WRONG_PHASE');
        if (room.phase.turnSeatId !== seat.id) throw new GameError('NOT_YOUR_TURN');
        const text = typeof action.text === 'string' ? action.text.trim().slice(0, 40) : '';
        if (!text) throw new GameError('INVALID');
        return resolve(room, ctx, text);
      }
      default:
        throw new GameError('INVALID');
    }
  },
  onDeadline(room, ctx) {
    const s = st(room);
    switch (room.phase.kind) {
      case 'clue':
        if (room.phase.turnSeatId) turnMissed(room, room.phase.turnSeatId, ctx);
        return nextClue(room, ctx);
      case 'discuss':
        return startVote(room, ctx, null);
      case 'vote':
      case 'revote':
        return closeVote(room, ctx);
      case 'guess':
        return resolve(room, ctx, null);
      case 'reveal':
        room.memory.imposterUsed = s.usedPairs.slice(-150);
        if (s.round >= s.set.rounds) return finishGame(room, ctx, s.stats);
        s.round += 1;
        return beginRound(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    const revealed = room.phase.kind === 'reveal';
    const tallied = room.phase.kind === 'revote' || room.phase.kind === 'guess' || revealed;
    return {
      round: s.round,
      rounds: s.set.rounds,
      clueRounds: s.set.clueRounds,
      players: s.players,
      order: s.order,
      clues: s.clues,
      ready: s.ready,
      votedIds: Object.keys(s.votes),
      revoteCandidates: s.revoteCandidates,
      tally: tallied ? s.tally : null,
      accused: room.phase.kind === 'guess' || revealed ? s.accused : null,
      // Secrets appear only at the reveal (R34).
      reveal: revealed
        ? { imposters: s.imposters, crewWord: s.crewWord, imposterWord: s.imposterWord, outcome: s.outcome, guess: s.guess }
        : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat || !s.players.includes(seat.id)) return { mustAct: false };
    const k = room.phase.kind;
    const mustAct =
      (k === 'clue' && room.phase.turnSeatId === seat.id) ||
      ((k === 'vote' || k === 'revote') && !s.votes[seat.id]) ||
      (k === 'guess' && room.phase.turnSeatId === seat.id);
    return {
      mustAct,
      word: wordOf(s, seat.id),
      isImposter: s.set.imposterKnows && s.imposters.includes(seat.id) ? true : null,
      myVote: s.votes[seat.id] ?? null,
      ready: s.ready.includes(seat.id),
    };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (!s.players.includes(seat.id)) return null;
    const k = room.phase.kind;
    if (k === 'clue' && room.phase.turnSeatId === seat.id) {
      const pair = PAIRS.find((p) => p.id === s.pairId)!;
      const mine = wordOf(s, seat.id);
      const hints = (mine === pair.a ? pair.hintsA : pair.hintsB).filter((h) => validClue(h, mine) && !s.clues.some((c) => fold(c.text) === fold(h)));
      return { delayMs: 1500 + Math.round(ctx.rng() * 1500), action: { type: 'clue', text: hints[0] ?? pick(ctx.rng, ['hmm', 'maybe', 'tasty', 'fun', 'common']) } };
    }
    if (k === 'discuss' && !s.ready.includes(seat.id)) return { delayMs: 2000, action: { type: 'ready' } };
    if ((k === 'vote' || k === 'revote') && !s.votes[seat.id]) {
      const options = (s.revoteCandidates ?? s.players).filter((id) => id !== seat.id);
      return { delayMs: 1500 + Math.round(ctx.rng() * 2000), action: { type: 'vote', seatId: pick(ctx.rng, options) } };
    }
    if (k === 'guess' && room.phase.turnSeatId === seat.id) {
      const text = ctx.rng() < 0.3 ? s.crewWord : pick(ctx.rng, PAIRS).a;
      return { delayMs: 2500, action: { type: 'guess', text } };
    }
    return null;
  },
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    s.players = s.players.filter((id) => id !== seatId);
    if (room.phase.turnSeatId === seatId) {
      if (room.phase.kind === 'clue') nextClue(room, ctx);
      else if (room.phase.kind === 'guess') resolve(room, ctx, null);
    }
  },
  stats(room) {
    return st(room).stats;
  },
};
