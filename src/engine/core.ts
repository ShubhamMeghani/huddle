/* Engine helpers shared by the room engine and the pure game modules. No registry imports here. */
import { GameError, type Ctx, type FinishedGame, type RoomState, type Seat, type SeatId } from './types';

export const DEFAULT_BREAK_MS = 30_000;

export function seatById(room: RoomState, id: SeatId | null | undefined): Seat | undefined {
  return id ? room.seats.find((s) => s.id === id) : undefined;
}

export function seatedPlayers(room: RoomState): Seat[] {
  return room.seats.filter((s) => s.status === 'seated');
}

/** Seated and not AFK: the players a phase waits for. */
export function activeSeats(room: RoomState): Seat[] {
  return room.seats.filter((s) => s.status === 'seated' && !s.afk);
}

export function addNotice(room: RoomState, text: string, ctx: Pick<Ctx, 'now'>, kind: 'admin' | 'system' = 'system') {
  room.noticeCounter += 1;
  room.notices.push({ id: room.noticeCounter, at: ctx.now, text, kind });
  if (room.notices.length > 10) room.notices.splice(0, room.notices.length - 10);
}

export function setPhase(room: RoomState, kind: string, durationMs: number | null, ctx: Pick<Ctx, 'now'>, turnSeatId: SeatId | null = null) {
  room.phase = {
    id: room.phase.id + 1,
    kind,
    deadline: durationMs == null ? null : ctx.now + durationMs,
    startedAt: ctx.now,
    durationMs,
    turnSeatId,
    endsAt: null,
  };
  room.botPlan = room.botPlan.filter((b) => b.phaseId === room.phase.id);
}

/** Records a scoring event (undoable, R25). Team targets add to the team score. */
export function award(room: RoomState, target: { seatId?: SeatId; teamId?: string }, points: number, reason: string) {
  if (!points) return;
  room.scoreEventCounter += 1;
  room.scoreEvents.push({ id: room.scoreEventCounter, target, points, reason, undone: false });
  if (target.teamId) room.teamScores[target.teamId] = (room.teamScores[target.teamId] ?? 0) + points;
  if (target.seatId) {
    const s = seatById(room, target.seatId);
    if (s) s.score += points;
  }
}

export function undoLastScore(room: RoomState): boolean {
  for (let i = room.scoreEvents.length - 1; i >= 0; i--) {
    const e = room.scoreEvents[i];
    if (e.undone) continue;
    e.undone = true;
    if (e.target.teamId) room.teamScores[e.target.teamId] = (room.teamScores[e.target.teamId] ?? 0) - e.points;
    if (e.target.seatId) {
      const s = seatById(room, e.target.seatId);
      if (s) s.score -= e.points;
    }
    return true;
  }
  return false;
}

/** A turn (or simultaneous phase) expired without this seat acting (R21). Admin skips don't count. */
export function turnMissed(room: RoomState, seatId: SeatId, ctx: Ctx) {
  if (ctx.skipping) return;
  const s = seatById(room, seatId);
  if (!s || s.isBot || s.status !== 'seated') return;
  s.missedTurns += 1;
  if (s.missedTurns >= 2 && !s.afk) {
    s.afk = true;
    addNotice(room, `${s.name} is AFK and will be skipped until they're back`, ctx);
  }
}

/** True when the seat is AFK: the turn is skipped immediately and counted for "Most AFK". */
export function skipIfAfk(room: RoomState, seatId: SeatId): boolean {
  const s = seatById(room, seatId);
  if (!s || s.status !== 'seated') return true;
  if (!s.afk) return false;
  s.afkSkips += 1;
  return true;
}

/** Seats spectators waiting for the next round (R9); in team games they join the smallest team. */
export function seatWaiting(room: RoomState, ctx: Pick<Ctx, 'now'>) {
  for (const s of room.seats) {
    if (s.status !== 'spectator' || !s.seatAtNextRound) continue;
    if (room.seats.filter((x) => x.status === 'seated').length >= 12) break;
    s.status = 'seated';
    s.seatAtNextRound = false;
    if (room.teams?.length) {
      const smallest = room.teams.reduce((a, b) => (b.seatIds.length < a.seatIds.length ? b : a));
      smallest.seatIds.push(s.id);
      s.teamId = smallest.id;
    }
    addNotice(room, `${s.name} joined the game`, ctx);
  }
}

/** Competition ranking: ties share a rank (1 + number of strictly higher scores). */
export function ranks(scores: number[]): number[] {
  return scores.map((s) => 1 + scores.filter((x) => x > s).length);
}

/** Placement points (SPEC §4.6): pp = round(100·(n−p)/(n−1)), ties take the average of the positions they cover. */
export function placementPoints(scores: number[]): number[] {
  const n = scores.length;
  if (n < 2) return scores.map(() => 0);
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const out = new Array<number>(n);
  let pos = 1;
  for (let k = 0; k < n; ) {
    let j = k;
    while (j + 1 < n && order[j + 1].s === order[k].s) j++;
    const avgPos = (pos + pos + (j - k)) / 2;
    const pp = Math.round((100 * (n - avgPos)) / (n - 1));
    for (let m = k; m <= j; m++) out[order[m].i] = pp;
    pos += j - k + 1;
    k = j + 1;
  }
  return out;
}

/** Ends the current game: standings, results effect, then a scoreboard break (R30). */
export function finishGame(
  room: RoomState,
  ctx: Ctx,
  stats: Record<SeatId, Record<string, number>> = {},
  opts: { excludeFromSeason?: boolean } = {},
) {
  const g = room.game;
  if (!g) return;
  const teamGame = Boolean(room.teams?.length) && Object.keys(room.teamScores).length > 0;
  const participants = room.seats.filter((s) => s.status === 'seated' || (s.status === 'spectator' && !s.seatAtNextRound && s.score !== 0));
  let rows: FinishedGame['rows'];
  if (teamGame && room.teams) {
    const teamIds = room.teams.map((t) => t.id);
    const tScores = teamIds.map((t) => room.teamScores[t] ?? 0);
    const tRanks = ranks(tScores);
    const tPP = placementPoints(tScores);
    rows = participants
      .filter((s) => s.teamId && teamIds.includes(s.teamId))
      .map((s) => {
        const ti = teamIds.indexOf(s.teamId!);
        return {
          seatId: s.id,
          identityId: s.identityId,
          name: s.name,
          teamId: s.teamId,
          score: tScores[ti],
          rank: tRanks[ti],
          placementPoints: tPP[ti],
          stats: { ...(stats[s.id] ?? {}), personal: s.score, afkSkips: s.afkSkips },
        };
      });
  } else {
    const scores = participants.map((s) => s.score);
    const r = ranks(scores);
    const pp = placementPoints(scores);
    rows = participants.map((s, i) => ({
      seatId: s.id,
      identityId: s.identityId,
      name: s.name,
      teamId: null,
      score: s.score,
      rank: r[i],
      placementPoints: pp[i],
      stats: { ...(stats[s.id] ?? {}), afkSkips: s.afkSkips },
    }));
  }
  const finished: FinishedGame = {
    gameNo: g.gameNo,
    gameId: g.id,
    settings: g.settings,
    startedAt: g.startedAt,
    endedAt: ctx.now,
    teamGame,
    ...(opts.excludeFromSeason ? { excludeFromSeason: true } : {}),
    rows: rows.sort((a, b) => a.rank - b.rank).map((r) => (opts.excludeFromSeason ? { ...r, placementPoints: 0 } : r)),
  };
  room.finished.push(finished);
  room.lastGame = finished;
  ctx.effects.push({ type: 'gameEnded', game: finished });
  room.game = null;
  room.status = 'break';
  room.botPlan = [];
  setPhase(room, 'break', ctx.breakMs, ctx);
}

export function requireAdmin(room: RoomState, seat: Seat) {
  if (room.adminSeatId !== seat.id) throw new GameError('NOT_ADMIN');
}
