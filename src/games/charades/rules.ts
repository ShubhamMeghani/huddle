/* Dumb Charades rules (R62–R66). Only the actor ever receives the title before the reveal. */
import moviesJson from '../../../content/movies.json';
import { award, finishGame, seatById, seatWaiting, setPhase, skipIfAfk, turnMissed } from '@/engine/core';
import { pick } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import type { GameModule } from '../types';

export interface Movie {
  id: string;
  industry: 'bollywood' | 'hollywood';
  title: string;
  year: number;
  era: 'classic' | 'golden' | 'modern';
  difficulty: 'easy' | 'medium' | 'hard';
}
export const MOVIES = moviesJson as Movie[];
const BY_ID = new Map(MOVIES.map((m) => [m.id, m]));

export const STEAL_MS = 15_000;
export const REVEAL_MS = 4_000;
export const STEAL_POINTS = 5;

interface CharadesSettings {
  rounds: number;
  seconds: number;
  passes: number;
  industries: string[];
  eras: string[];
  difficulty: string;
  steal: boolean;
}

interface CharadesState {
  set: CharadesSettings;
  round: number;
  teamIdx: number;
  actorIdx: Record<string, number>;
  teamId: string | null;
  actorId: SeatId | null;
  movieId: string | null;
  passesLeft: number;
  used: string[];
  last: { teamId: string; title: string; result: 'guessed' | 'timeout' | 'stolen'; points: number; stolenBy: string | null } | null;
  stats: Record<SeatId, { actedTurns: number; actedGuessed: number }>;
}

const st = (room: RoomState) => room.game!.state as CharadesState;

/** Guessed within the team timer: 10 points + 1 per full 10 s remaining (R64). */
export function guessedPoints(remainingMs: number): number {
  return 10 + Math.floor(Math.max(0, remainingMs) / 10_000);
}

function pickMovie(s: CharadesState, rng: () => number): string {
  const pool = MOVIES.filter(
    (m) => s.set.industries.includes(m.industry) && s.set.eras.includes(m.era) && (s.set.difficulty === 'any' || m.difficulty === s.set.difficulty),
  );
  const fresh = pool.filter((m) => !s.used.includes(m.id));
  const m = pick(rng, fresh.length ? fresh : pool.length ? pool : MOVIES);
  s.used.push(m.id);
  return m.id;
}

function teams(room: RoomState) {
  return (room.teams ?? []).filter((t) => t.seatIds.some((id) => seatById(room, id)?.status === 'seated'));
}

function startTurn(room: RoomState, ctx: Ctx) {
  const s = st(room);
  const list = teams(room);
  if (s.teamIdx >= list.length) {
    if (s.round >= s.set.rounds) return finishGame(room, ctx, s.stats);
    s.round += 1;
    s.teamIdx = 0;
    seatWaiting(room, ctx);
    return startTurn(room, ctx);
  }
  const team = list[s.teamIdx];
  const members = team.seatIds.filter((id) => seatById(room, id)?.status === 'seated');
  // Rotate actors within the team; skip AFK members (R21).
  for (let tries = 0; tries < members.length; tries++) {
    const i = (s.actorIdx[team.id] ?? 0) % members.length;
    s.actorIdx[team.id] = i + 1;
    const actor = members[i];
    if (skipIfAfk(room, actor)) continue;
    s.teamId = team.id;
    s.actorId = actor;
    s.movieId = pickMovie(s, ctx.rng);
    s.passesLeft = s.set.passes;
    (s.stats[actor] ??= { actedTurns: 0, actedGuessed: 0 }).actedTurns += 1;
    return setPhase(room, 'act', s.set.seconds * 1000, ctx, actor);
  }
  s.teamIdx += 1; // the whole team is AFK
  return startTurn(room, ctx);
}

function reveal(room: RoomState, ctx: Ctx, result: 'guessed' | 'timeout' | 'stolen', points: number, stolenBy: string | null) {
  const s = st(room);
  s.last = { teamId: stolenBy ?? s.teamId!, title: BY_ID.get(s.movieId!)!.title, result, points, stolenBy };
  setPhase(room, 'reveal', ctx.testMode ? 2_500 : REVEAL_MS, ctx);
}

export const charades: GameModule = {
  id: 'charades',
  start(room, ctx) {
    room.game!.state = {
      set: room.game!.settings as unknown as CharadesSettings,
      round: 1,
      teamIdx: 0,
      actorIdx: {},
      teamId: null,
      actorId: null,
      movieId: null,
      passesLeft: 0,
      used: ((room.memory ??= {}).charadesUsed as string[] | undefined) ?? [],
      last: null,
      stats: {},
    } satisfies CharadesState;
    if (teams(room).length < 2) throw new GameError('INVALID', 'Dumb Charades needs at least two teams');
    startTurn(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    if (seat.id !== s.actorId) throw new GameError('NOT_YOUR_TURN'); // only the actor taps (decision Q10)
    switch (action.type) {
      case 'guessed': {
        if (room.phase.kind !== 'act') throw new GameError('WRONG_PHASE');
        const points = guessedPoints((room.phase.deadline ?? ctx.now) - ctx.now);
        award(room, { teamId: s.teamId! }, points, 'charades guessed');
        s.stats[seat.id].actedGuessed += 1;
        return reveal(room, ctx, 'guessed', points, null);
      }
      case 'pass': {
        if (room.phase.kind !== 'act') throw new GameError('WRONG_PHASE');
        if (s.passesLeft <= 0) throw new GameError('INVALID', 'No passes left');
        s.passesLeft -= 1;
        s.movieId = pickMovie(s, ctx.rng);
        return;
      }
      case 'steal': {
        if (room.phase.kind !== 'steal') throw new GameError('WRONG_PHASE');
        const teamId = action.teamId == null ? null : String(action.teamId);
        if (teamId !== null && (teamId === s.teamId || !teams(room).some((t) => t.id === teamId))) throw new GameError('INVALID');
        if (teamId) {
          award(room, { teamId }, STEAL_POINTS, 'charades steal');
          return reveal(room, ctx, 'stolen', STEAL_POINTS, teamId);
        }
        return reveal(room, ctx, 'timeout', 0, null);
      }
      default:
        throw new GameError('INVALID');
    }
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'act') {
      if (s.set.steal && teams(room).length > 1) return setPhase(room, 'steal', ctx.testMode ? 5_000 : STEAL_MS, ctx, s.actorId);
      return reveal(room, ctx, 'timeout', 0, null);
    }
    if (room.phase.kind === 'steal') {
      if (s.actorId) turnMissed(room, s.actorId, ctx);
      return reveal(room, ctx, 'timeout', 0, null);
    }
    if (room.phase.kind === 'reveal') {
      (room.memory ??= {}).charadesUsed = s.used.slice(-300);
      s.teamIdx += 1;
      return startTurn(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    return {
      round: s.round,
      rounds: s.set.rounds,
      teamId: s.teamId,
      actorId: s.actorId,
      passesLeft: s.passesLeft,
      steal: s.set.steal,
      // The title appears publicly only in the reveal (R34).
      last: room.phase.kind === 'reveal' ? s.last : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    if (seat.id !== s.actorId || (room.phase.kind !== 'act' && room.phase.kind !== 'steal')) return { mustAct: false };
    const m = BY_ID.get(s.movieId!)!;
    return { mustAct: true, actor: true, movie: { title: m.title, year: m.year, industry: m.industry, era: m.era, words: m.title.split(/\s+/).length } };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (seat.id !== s.actorId) return null;
    if (room.phase.kind === 'act') {
      if (s.passesLeft > 0 && ctx.rng() < 0.2) return { delayMs: 3000, action: { type: 'pass' } };
      const limit = s.set.seconds * 1000;
      const delay = 4000 + Math.round(ctx.rng() * limit * 0.9);
      return delay < limit ? { delayMs: delay, action: { type: 'guessed' } } : null;
    }
    if (room.phase.kind === 'steal') return { delayMs: 2000, action: { type: 'steal', teamId: null } };
    return null;
  },
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    if (s.actorId === seatId && (room.phase.kind === 'act' || room.phase.kind === 'steal')) reveal(room, ctx, 'timeout', 0, null);
  },
  stats(room) {
    return st(room).stats;
  },
};
