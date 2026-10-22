/* Most Likely To (R88, R89). Individual votes live only until the tally; views never contain them. */
import promptsJson from '../../../content/mlt-prompts.json';
import { activeSeats, finishGame, seatById, seatWaiting, setPhase, turnMissed } from '@/engine/core';
import { pick } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import type { GameModule } from '../types';

export const PROMPTS = promptsJson as { id: string; text: string }[];
export const REVEAL_MS = 6_000;

interface MltState {
  rounds: number;
  voteMs: number;
  selfVote: boolean;
  round: number;
  promptId: string;
  used: string[];
  /** voter → votee, only during the vote phase (discarded at tally). */
  votes: Record<SeatId, SeatId>;
  voted: SeatId[];
  totals: { seatId: SeatId; votes: number }[] | null;
  stats: Record<SeatId, { mltVotes: number; mltWins: number }>;
}

const st = (room: RoomState) => room.game!.state as MltState;

/** Totals sorted for the dramatic reveal: fewest votes first (R88). */
export function tallyOf(votes: Record<SeatId, SeatId>, players: SeatId[]): { seatId: SeatId; votes: number }[] {
  const counts = new Map(players.map((id) => [id, 0]));
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  return [...counts].map(([seatId, n]) => ({ seatId, votes: n })).sort((a, b) => a.votes - b.votes || (a.seatId < b.seatId ? -1 : 1));
}

function startRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  const fresh = PROMPTS.filter((p) => !s.used.includes(p.id));
  const p = pick(ctx.rng, fresh.length ? fresh : PROMPTS);
  s.used.push(p.id);
  s.promptId = p.id;
  s.votes = {};
  s.voted = [];
  s.totals = null;
  setPhase(room, 'vote', s.voteMs, ctx);
}

function tally(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (const x of activeSeats(room)) if (!s.voted.includes(x.id)) turnMissed(room, x.id, ctx);
  const players = room.seats.filter((x) => x.status === 'seated').map((x) => x.id);
  s.totals = tallyOf(s.votes, players);
  s.votes = {}; // R89: who voted for whom is gone; only totals remain
  const max = Math.max(0, ...s.totals.map((t) => t.votes));
  for (const t of s.totals) {
    const stat = (s.stats[t.seatId] ??= { mltVotes: 0, mltWins: 0 });
    stat.mltVotes += t.votes;
    if (max > 0 && t.votes === max) stat.mltWins += 1;
  }
  setPhase(room, 'reveal', ctx.testMode ? 8_000 : REVEAL_MS, ctx);
}

export const mlt: GameModule = {
  id: 'mlt',
  start(room, ctx) {
    const set = room.game!.settings as { rounds: number; voteSeconds: number; selfVote: boolean };
    room.game!.state = {
      rounds: set.rounds,
      voteMs: set.voteSeconds * 1000,
      selfVote: set.selfVote,
      round: 1,
      promptId: '',
      used: ((room.memory ??= {}).mltUsed as string[] | undefined) ?? [],
      votes: {},
      voted: [],
      totals: null,
      stats: {},
    } satisfies MltState;
    startRound(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    if (action.type !== 'vote') throw new GameError('INVALID');
    if (room.phase.kind !== 'vote') throw new GameError('WRONG_PHASE');
    const target = String(action.seatId ?? '');
    if (seatById(room, target)?.status !== 'seated') throw new GameError('INVALID');
    if (!s.selfVote && target === seat.id) throw new GameError('INVALID', 'Self-votes are off');
    if (s.voted.includes(seat.id)) throw new GameError('INVALID', 'Already voted');
    s.votes[seat.id] = target;
    s.voted.push(seat.id);
    if (activeSeats(room).every((x) => s.voted.includes(x.id))) tally(room, ctx);
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'vote') return tally(room, ctx);
    if (room.phase.kind === 'reveal') {
      room.memory.mltUsed = s.used.slice(-150);
      if (s.round >= s.rounds) {
        for (const x of room.seats) x.score = 0; // fun only: no points (Q6)
        return finishGame(room, ctx, s.stats, { excludeFromSeason: true });
      }
      s.round += 1;
      return startRound(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    const prompt = PROMPTS.find((p) => p.id === s.promptId)!;
    return {
      round: s.round,
      rounds: s.rounds,
      prompt: prompt.text,
      votedIds: s.voted,
      selfVote: s.selfVote,
      totals: room.phase.kind === 'reveal' ? s.totals : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const voted = s.voted.includes(seat.id);
    return { mustAct: room.phase.kind === 'vote' && !voted, voted };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind !== 'vote' || s.voted.includes(seat.id)) return null;
    const options = room.seats.filter((x) => x.status === 'seated' && (s.selfVote || x.id !== seat.id)).map((x) => x.id);
    return { delayMs: 1500 + Math.round(ctx.rng() * 3000), action: { type: 'vote', seatId: pick(ctx.rng, options) } };
  },
  stats(room) {
    return st(room).stats;
  },
};
