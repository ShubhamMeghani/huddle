/* Two Truths & a Lie (R103). Everyone writes three statements and marks the lie; then each player's statements
 * are shown in a shuffled order and the others vote for the lie. Statements and lies stay secret until revealed. */
import botJson from '../../../content/two-truths-bot.json';
import { activeSeats, award, finishGame, seatById, seatWaiting, setPhase, turnMissed } from '@/engine/core';
import { pick, shuffle } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold } from '@/lib/text';
import type { GameModule } from '../types';

export const BOT_SETS = botJson as { texts: [string, string, string]; lie: number }[];
export const MAX_STATEMENT = 80;
export const REVEAL_MS = 6_000;
export const SPOT_POINTS = 100;
export const FOOL_POINTS = 50;

interface Entry {
  texts: string[];
  lie: number | null;
}

interface TruthsState {
  writeMs: number;
  voteMs: number;
  /** Drafts and submissions: only the author sees them before their reveal. */
  entries: Record<SeatId, Entry>;
  done: SeatId[];
  order: SeatId[];
  turn: number;
  /** Display position → the author's original position, for the current subject. */
  perm: number[];
  /** voter → display position, for the current subject. */
  votes: Record<SeatId, number>;
  reveal: { lie: number; counts: number[]; votes: Record<SeatId, number>; points: Record<SeatId, number> } | null;
  stats: Record<SeatId, { liesSpotted: number; peopleFooled: number }>;
}

const st = (room: RoomState) => room.game!.state as TruthsState;

/** Three distinct, non-empty statements (≤ 80 chars) and a lie index 0–2, or INVALID. */
export function validateEntry(texts: unknown, lie: unknown): { texts: string[]; lie: number } {
  if (!Array.isArray(texts) || texts.length !== 3 || !texts.every((t) => typeof t === 'string')) throw new GameError('INVALID', 'Write three statements');
  const clean = (texts as string[]).map((t) => t.trim().slice(0, MAX_STATEMENT));
  if (clean.some((t) => !fold(t))) throw new GameError('INVALID', 'Write three statements');
  if (new Set(clean.map(fold)).size !== 3) throw new GameError('INVALID', 'The three statements must be different');
  const l = typeof lie === 'number' ? lie : NaN; // a missing lie must not read as statement 1
  if (!Number.isInteger(l) || l < 0 || l > 2) throw new GameError('INVALID', 'Mark which one is the lie');
  return { texts: clean, lie: l };
}

/** Voters who spot the lie get 100; the subject gets 50 for each voter fooled. */
export function scoreVotes(subject: SeatId, lie: number, votes: Record<SeatId, number>): Record<SeatId, number> {
  const points: Record<SeatId, number> = { [subject]: 0 };
  for (const [voter, choice] of Object.entries(votes)) {
    if (choice === lie) points[voter] = SPOT_POINTS;
    else points[subject] += FOOL_POINTS;
  }
  return points;
}

function subjectOf(s: TruthsState): SeatId | null {
  return s.order[s.turn] ?? null;
}

function endWrite(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const seat of activeSeats(room)) if (!s.done.includes(seat.id)) turnMissed(room, seat.id, ctx);
  s.order = room.seats.filter((x) => x.status === 'seated' && s.done.includes(x.id)).map((x) => x.id);
  s.turn = -1;
  nextSubject(room, ctx);
}

function nextSubject(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (s.turn += 1; s.turn < s.order.length; s.turn++) {
    if (seatById(room, s.order[s.turn])?.status === 'seated') break;
  }
  const subject = subjectOf(s);
  if (!subject) return finishGame(room, ctx, s.stats);
  seatWaiting(room, ctx);
  s.perm = shuffle(ctx.rng, [0, 1, 2]);
  s.votes = {};
  s.reveal = null;
  setPhase(room, 'vote', s.voteMs, ctx, subject);
}

function voters(room: RoomState, s: TruthsState) {
  return activeSeats(room).filter((x) => x.id !== subjectOf(s));
}

function reveal(room: RoomState, ctx: Ctx) {
  const s = st(room);
  const subject = subjectOf(s)!;
  for (const x of voters(room, s)) if (s.votes[x.id] === undefined) turnMissed(room, x.id, ctx);
  const lie = s.perm.indexOf(s.entries[subject].lie!);
  const points = scoreVotes(subject, lie, s.votes);
  for (const [id, p] of Object.entries(points)) award(room, { seatId: id }, p, 'two truths');
  const counts = [0, 0, 0];
  for (const [voter, c] of Object.entries(s.votes)) {
    counts[c] += 1;
    if (c === lie) (s.stats[voter] ??= { liesSpotted: 0, peopleFooled: 0 }).liesSpotted += 1;
    else (s.stats[subject] ??= { liesSpotted: 0, peopleFooled: 0 }).peopleFooled += 1;
  }
  s.reveal = { lie, counts, votes: { ...s.votes }, points };
  setPhase(room, 'reveal', ctx.testMode ? 8_000 : REVEAL_MS, ctx, subject);
}

export const truths: GameModule = {
  id: 'truths',
  start(room, ctx) {
    const set = room.game!.settings as { writeSeconds: number; voteSeconds: number };
    room.game!.state = {
      writeMs: set.writeSeconds * 1000,
      voteMs: set.voteSeconds * 1000,
      entries: {},
      done: [],
      order: [],
      turn: -1,
      perm: [0, 1, 2],
      votes: {},
      reveal: null,
      stats: {},
    } satisfies TruthsState;
    setPhase(room, 'write', set.writeSeconds * 1000, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    switch (action.type) {
      case 'fill': {
        // Draft autosave, so a timer that ends mid-sentence doesn't lose what was typed.
        if (room.phase.kind !== 'write') throw new GameError('WRONG_PHASE');
        if (s.done.includes(seat.id)) throw new GameError('INVALID', 'Already submitted');
        const texts = Array.isArray(action.texts) ? action.texts.slice(0, 3).map((t) => (typeof t === 'string' ? t.slice(0, MAX_STATEMENT) : '')) : null;
        if (!texts) throw new GameError('INVALID');
        const lie = Number.isInteger(action.lie) && (action.lie as number) >= 0 && (action.lie as number) <= 2 ? (action.lie as number) : null;
        s.entries[seat.id] = { texts, lie };
        return;
      }
      case 'submit': {
        if (room.phase.kind !== 'write') throw new GameError('WRONG_PHASE');
        if (s.done.includes(seat.id)) throw new GameError('INVALID', 'Already submitted');
        s.entries[seat.id] = validateEntry(action.texts, action.lie);
        s.done.push(seat.id);
        if (activeSeats(room).every((x) => s.done.includes(x.id))) endWrite(room, ctx);
        return;
      }
      case 'vote': {
        if (room.phase.kind !== 'vote') throw new GameError('WRONG_PHASE');
        if (seat.id === subjectOf(s)) throw new GameError('INVALID', 'You can’t vote on your own statements');
        if (s.votes[seat.id] !== undefined) throw new GameError('INVALID', 'Already voted');
        const choice = Number(action.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw new GameError('INVALID');
        s.votes[seat.id] = choice;
        if (voters(room, s).every((x) => s.votes[x.id] !== undefined)) reveal(room, ctx);
        return;
      }
      default:
        throw new GameError('INVALID');
    }
  },
  onDeadline(room, ctx) {
    if (room.phase.kind === 'write') return endWrite(room, ctx);
    if (room.phase.kind === 'vote') return reveal(room, ctx);
    if (room.phase.kind === 'reveal') return nextSubject(room, ctx);
  },
  publicView(room) {
    const s = st(room);
    const subject = room.phase.kind === 'write' ? null : subjectOf(s);
    const entry = subject ? s.entries[subject] : null;
    return {
      doneIds: s.done,
      order: s.order,
      turn: s.turn,
      subject,
      // Statements appear only on their author's turn, shuffled; the lie and the votes only at the reveal (R34).
      statements: entry ? s.perm.map((i) => entry.texts[i]) : null,
      votedIds: room.phase.kind === 'vote' ? Object.keys(s.votes) : [],
      reveal: room.phase.kind === 'reveal' ? s.reveal : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const kind = room.phase.kind;
    const subject = subjectOf(s);
    const mustAct = (kind === 'write' && !s.done.includes(seat.id)) || (kind === 'vote' && seat.id !== subject && s.votes[seat.id] === undefined);
    const mine = s.entries[seat.id] ?? null;
    return {
      mustAct,
      mine: kind === 'write' ? mine : null,
      done: s.done.includes(seat.id),
      myVote: kind === 'vote' ? (s.votes[seat.id] ?? null) : null,
      // The author already knows their lie; showing it on their own turn lets them enjoy the votes.
      myLie: kind === 'vote' && seat.id === subject && mine?.lie != null ? s.perm.indexOf(mine.lie) : null,
    };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind === 'write' && !s.done.includes(seat.id)) {
      const set = pick(ctx.rng, BOT_SETS);
      return { delayMs: Math.round(Math.min(s.writeMs * 0.7, 3000 + ctx.rng() * 6000)), action: { type: 'submit', texts: set.texts, lie: set.lie } };
    }
    if (room.phase.kind === 'vote' && seat.id !== subjectOf(s) && s.votes[seat.id] === undefined) {
      return { delayMs: 1500 + Math.round(ctx.rng() * 3000), action: { type: 'vote', choice: Math.floor(ctx.rng() * 3) } };
    }
    return null;
  },
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    delete s.entries[seatId];
    s.done = s.done.filter((id) => id !== seatId);
    if (room.phase.kind === 'write') {
      if (activeSeats(room).every((x) => s.done.includes(x.id))) endWrite(room, ctx);
    } else if (subjectOf(s) === seatId) {
      nextSubject(room, ctx);
    } else if (room.phase.kind === 'vote' && voters(room, s).every((x) => s.votes[x.id] !== undefined)) {
      reveal(room, ctx);
    }
  },
  stats(room) {
    return st(room).stats;
  },
};
