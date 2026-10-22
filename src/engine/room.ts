/* Room engine: pure functions over RoomState. The server pipeline clones state, calls these,
 * and persists the result. Games plug in through src/games/registry.ts. */
import { pickAvatarColor, AVATAR_EMOJIS } from '@/lib/avatars';
import {
  GameError,
  type Ctx,
  type GameAction,
  type RoomState,
  type Seat,
  type Viewer,
} from './types';

export const MAX_SEATED = 12;
export const MAX_SPECTATORS = 8;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function newRoomState(opts: {
  roomId: string;
  code: string;
  isDemo?: boolean;
  crewId?: string | null;
  now: number;
  seed: string;
}): RoomState {
  return {
    v: 0,
    roomId: opts.roomId,
    code: opts.code,
    isDemo: Boolean(opts.isDemo),
    crewId: opts.crewId ?? null,
    createdAt: opts.now,
    status: 'lobby',
    adminSeatId: null,
    seats: [],
    seatCounter: 0,
    teams: null,
    queue: [],
    queueIndex: 0,
    phase: { id: 0, kind: 'lobby', deadline: null, startedAt: opts.now, durationMs: null, turnSeatId: null },
    paused: null,
    game: null,
    gameCounter: 0,
    scoreEvents: [],
    scoreEventCounter: 0,
    finished: [],
    rngSeed: opts.seed,
    rngCounter: 0,
    botPlan: [],
    notices: [],
    noticeCounter: 0,
    pendingClaims: [],
    waves: 0,
    rate: {},
    chatRate: {},
  };
}

export function seatOf(room: RoomState, identityIds: string[]): Seat | undefined {
  return room.seats.find((s) => identityIds.includes(s.identityId));
}

export function seated(room: RoomState): Seat[] {
  return room.seats.filter((s) => s.status === 'seated');
}

export function humans(room: RoomState): Seat[] {
  return room.seats.filter((s) => s.status !== 'kicked' && !s.isBot);
}

export function addNotice(room: RoomState, text: string, ctx: Ctx, kind: 'admin' | 'system' = 'system') {
  room.noticeCounter += 1;
  room.notices.push({ id: room.noticeCounter, at: ctx.now, text, kind });
  if (room.notices.length > 10) room.notices.splice(0, room.notices.length - 10);
}

export function joinRoom(
  room: RoomState,
  who: { identityIds: string[]; identityId: string; name: string; isBot?: boolean; deviceId?: string | null },
  ctx: Ctx,
  opts: { spectate?: boolean } = {},
): Seat {
  const existing = seatOf(room, who.identityIds);
  if (existing) {
    if (existing.status === 'kicked') throw new GameError('KICKED');
    if (who.deviceId) existing.deviceId = who.deviceId; // explicit join moves the seat to this device
    return existing; // rejoin: same seat, same score
  }
  const seatedCount = seated(room).length + room.seats.filter((s) => s.status === 'spectator' && s.seatAtNextRound).length;
  const gameRunning = room.status === 'playing' || room.status === 'break';
  const full = seatedCount >= MAX_SEATED;
  const wantsSpectate = opts.spectate || full || gameRunning;
  if (wantsSpectate) {
    const spectators = room.seats.filter((s) => s.status === 'spectator' && !s.seatAtNextRound).length;
    if (full && spectators >= MAX_SPECTATORS) throw new GameError('ROOM_FULL');
  }
  room.seatCounter += 1;
  const seat: Seat = {
    id: `s${room.seatCounter}`,
    identityId: who.identityId,
    name: who.name,
    avatar: {
      color: pickAvatarColor(room.seats.filter((s) => s.status !== 'kicked').map((s) => s.avatar.color)),
      emoji: AVATAR_EMOJIS[(room.seatCounter - 1) % AVATAR_EMOJIS.length],
    },
    joinedAt: ctx.now,
    status: wantsSpectate ? 'spectator' : 'seated',
    // Late joiners (not a full room, not an explicit spectator) are seated at the next round.
    seatAtNextRound: wantsSpectate && !full && !opts.spectate,
    missedTurns: 0,
    afk: false,
    afkSkips: 0,
    isBot: Boolean(who.isBot),
    teamId: null,
    score: 0,
    deviceId: who.deviceId ?? null,
  };
  room.seats.push(seat);
  if (!room.adminSeatId && !seat.isBot && seat.status === 'seated') room.adminSeatId = seat.id;
  return seat;
}

/** Engine-level actions available in Phase 1. Later phases extend this dispatcher. */
export function applyAction(room: RoomState, seat: Seat, action: GameAction, ctx: Ctx): void {
  void ctx;
  switch (action.type) {
    case 'wave':
      if (seat.status !== 'seated') throw new GameError('NOT_SEATED');
      room.waves += 1;
      return;
    default:
      throw new GameError('INVALID', `Unknown action ${action.type}`);
  }
}

/** Process overdue deadlines etc. Phase 1: nothing time-based exists yet. */
export function catchUp(room: RoomState, ctx: Ctx): void {
  void room;
  void ctx;
}

export interface PublicSeat {
  id: string;
  name: string;
  avatar: { color: number; emoji: string };
  status: Seat['status'];
  seatAtNextRound: boolean;
  afk: boolean;
  isBot: boolean;
  teamId: string | null;
  score: number;
  connected: boolean;
  joinedAt: number;
}

export function publicView(room: RoomState, presence: Record<string, number>, now: number) {
  return {
    v: room.v,
    roomId: room.roomId,
    code: room.code,
    isDemo: room.isDemo,
    crewId: room.crewId,
    status: room.status,
    adminSeatId: room.adminSeatId,
    seats: room.seats
      .filter((s) => s.status !== 'kicked')
      .map<PublicSeat>((s) => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        status: s.status,
        seatAtNextRound: s.seatAtNextRound,
        afk: s.afk,
        isBot: s.isBot,
        teamId: s.teamId,
        score: s.score,
        connected: s.isBot || now - (presence[s.identityId] ?? 0) < 60_000,
        joinedAt: s.joinedAt,
      })),
    teams: room.teams,
    phase: room.phase,
    paused: room.paused,
    notices: room.notices,
    waves: room.waves,
    nextWakeAt: nextWakeAt(room),
  };
}

export type PublicView = ReturnType<typeof publicView>;

export function nextWakeAt(room: RoomState): number | null {
  if (room.paused) return null;
  const times = [room.phase.deadline, ...room.botPlan.map((b) => b.dueAt)].filter(
    (t): t is number => typeof t === 'number',
  );
  return times.length ? Math.min(...times) : null;
}

export function privateView(room: RoomState, viewer: Viewer) {
  const seat = viewer.kind === 'player' || viewer.kind === 'spectator' ? room.seats.find((s) => s.id === viewer.seatId) : undefined;
  return {
    seatId: seat?.id ?? null,
    role: seat ? (seat.status === 'seated' ? 'player' : seat.status) : viewer.kind === 'screen' ? 'screen' : 'none',
    isAdmin: Boolean(seat && room.adminSeatId === seat.id),
    deviceId: seat?.deviceId ?? null,
  };
}

export type PrivateView = ReturnType<typeof privateView>;

/** Seats whose private view changed between two states (SPEC §4.2 privateFor). */
export function privateChanges(before: RoomState, after: RoomState): string[] {
  const out: string[] = [];
  for (const s of after.seats) {
    const v: Viewer = { kind: 'player', seatId: s.id };
    if (JSON.stringify(privateView(before, v)) !== JSON.stringify(privateView(after, v))) out.push(s.id);
  }
  return out;
}

export function viewerFor(room: RoomState, identityIds: string[], screen = false): Viewer {
  if (screen) return { kind: 'screen' };
  const seat = seatOf(room, identityIds);
  if (!seat || seat.status === 'kicked') return { kind: 'public' };
  return seat.status === 'seated' ? { kind: 'player', seatId: seat.id } : { kind: 'spectator', seatId: seat.id };
}
