/* Room engine: pure functions over RoomState. The server pipeline clones state, runs catchUp,
 * applies one operation, plans bots, and persists the result (SPEC §4.2–4.3). */
import { pickAvatarColor, AVATAR_EMOJIS } from '@/lib/avatars';
import { metaOf, GAME_META } from '@/games/meta';
import { validateSettings } from '@/games/settings';
import { hasModule, moduleOf } from '@/games/registry';
import { balanceTeams } from './teams';
import { computeAwards } from './awards';
import { DEMO_GAMES, demoSettings } from '@/games/demo';
import { strengthFor } from './elo';
import {
  activeSeats,
  addNotice,
  award,
  finishGame,
  requireAdmin,
  seatById,
  seatWaiting,
  setPhase,
  undoLastScore,
} from './core';
import {
  GameError,
  type Ctx,
  type GameAction,
  type GameConfig,
  type GameId,
  type RoomState,
  type Seat,
  type Viewer,
} from './types';

export const MAX_SEATED = 12;
export const MAX_SPECTATORS = 8;
export const MAX_SCREENS = 2;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const PRESENCE_MS = 60_000;
/** How long the How-to-play card shows before a game's first round, unless everyone taps Got it (R95). */
export const INTRO_MS = 20_000;

export { addNotice };

export function newRoomState(opts: {
  roomId: string;
  code: string;
  isDemo?: boolean;
  crewId?: string | null;
  now: number;
  seed: string;
  /** How-to-play cards (R95); the server turns them on except in test mode. */
  intros?: boolean;
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
    teamScores: {},
    finished: [],
    lastGame: null,
    rngSeed: opts.seed,
    rngCounter: 0,
    botPlan: [],
    notices: [],
    noticeCounter: 0,
    pendingClaims: [],
    memory: {},
    intros: opts.intros ?? false,
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

function connected(seat: Seat, ctx: Pick<Ctx, 'now' | 'presence' | 'presenceMs'>): boolean {
  return seat.isBot || ctx.now - (ctx.presence[seat.identityId] ?? 0) < ctx.presenceMs;
}

/* ───────────────────────── joining ───────────────────────── */

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
    return existing; // rejoin: same seat, same score (R15)
  }
  const committed = seated(room).length + room.seats.filter((s) => s.status === 'spectator' && s.seatAtNextRound).length;
  const gameRunning = room.status === 'playing' || room.status === 'break';
  const full = committed >= MAX_SEATED;
  const spectate = Boolean(opts.spectate) || full || gameRunning;
  if (spectate) {
    const watchers = room.seats.filter((s) => s.status === 'spectator' && !s.seatAtNextRound).length;
    if ((full || opts.spectate) && watchers >= MAX_SPECTATORS) throw new GameError('ROOM_FULL');
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
    status: spectate ? 'spectator' : 'seated',
    seatAtNextRound: spectate && !full && !opts.spectate, // late joiners are seated at the next round (R9)
    missedTurns: 0,
    afk: false,
    afkSkips: 0,
    isBot: Boolean(who.isBot),
    teamId: null,
    score: 0,
    deviceId: who.deviceId ?? null,
  };
  room.seats.push(seat);
  if (seat.status === 'seated' && room.teams?.length) {
    const smallest = room.teams.reduce((a, b) => (b.seatIds.length < a.seatIds.length ? b : a));
    smallest.seatIds.push(seat.id);
    seat.teamId = smallest.id;
  }
  if (!room.adminSeatId && !seat.isBot && seat.status === 'seated') room.adminSeatId = seat.id;
  return seat;
}

/** "That's me" on a disconnected seat (R17): queued for approval. */
export function requestClaim(room: RoomState, seatId: string, claimant: { identityId: string; name: string }, ctx: Ctx) {
  const seat = seatById(room, seatId);
  if (!seat || seat.status === 'kicked' || seat.isBot) throw new GameError('INVALID');
  if (connected(seat, ctx)) throw new GameError('INVALID', 'That seat is still connected');
  room.pendingClaims = room.pendingClaims.filter((c) => c.claimantIdentityId !== claimant.identityId);
  room.pendingClaims.push({ seatId, claimantIdentityId: claimant.identityId, claimantName: claimant.name, at: ctx.now });
  addNotice(room, `${claimant.name} says they are ${seat.name}`, ctx);
}

/* ───────────────────────── game lifecycle ───────────────────────── */

/** The running game's module; null while the How-to-play card shows, because the module has not started. */
function gameModule(room: RoomState) {
  return room.game && room.game.state != null ? moduleOf(room.game.id) : null;
}

function introDue(room: RoomState, gameId: GameId): boolean {
  const seen = (room.memory.introSeen as GameId[] | undefined) ?? [];
  return room.intros !== false && Boolean(metaOf(gameId).intro) && !seen.includes(gameId);
}

/** Ends the How-to-play card and starts the game's first round. */
function beginGame(room: RoomState, ctx: Ctx) {
  const g = room.game!;
  g.intro = null;
  try {
    moduleOf(g.id).start(room, ctx);
  } catch (e) {
    if (!(e instanceof GameError)) throw e;
    // The game cannot start (e.g. no quiz questions left in those categories): skip it after a short break.
    addNotice(room, e.message, ctx);
    room.game = null;
    room.status = 'break';
    room.botPlan = [];
    setPhase(room, 'break', ctx.breakMs, ctx);
  }
}

function ensureTeams(room: RoomState, gameId: GameId, ctx: Ctx) {
  const meta = metaOf(gameId);
  const wantsTeams = meta.teams === 'required' || (meta.teams === 'optional' && room.queue[room.queueIndex]?.settings.mode === 'teams');
  if (!wantsTeams) {
    for (const s of room.seats) s.teamId = null;
    return;
  }
  const players = seated(room);
  const covered = room.teams && players.every((p) => room.teams!.some((t) => t.seatIds.includes(p.id)));
  if (!room.teams || !covered) room.teams = balanceTeams(players, room.teams?.length ?? 2, strengths(room, ctx, gameId), ctx);
  for (const t of room.teams) t.seatIds = t.seatIds.filter((id) => seatById(room, id)?.status === 'seated');
  for (const s of room.seats) s.teamId = room.teams.find((t) => t.seatIds.includes(s.id))?.id ?? null;
}

export function startGame(room: RoomState, ctx: Ctx) {
  const cfg = room.queue[room.queueIndex];
  if (!cfg) throw new GameError('INVALID', 'Queue is empty');
  seatWaiting(room, ctx);
  const meta = metaOf(cfg.gameId);
  if (seated(room).length < meta.minPlayers) throw new GameError('INVALID', `${meta.title} needs at least ${meta.minPlayers} players`);
  ensureTeams(room, cfg.gameId, ctx);
  for (const s of room.seats) {
    s.score = 0;
    s.missedTurns = 0;
    s.afkSkips = 0; // per-game stats (Most AFK sums them across the night)
    s.missedTotal = 0;
  }
  room.scoreEvents = [];
  room.teamScores = room.teams && room.seats.some((s) => s.teamId) ? Object.fromEntries(room.teams.map((t) => [t.id, 0])) : {};
  room.gameCounter += 1;
  room.game = { id: cfg.gameId, gameNo: room.gameCounter, settings: cfg.settings, startedAt: ctx.now, state: null };
  room.status = 'playing';
  room.paused = null;
  room.botPlan = [];
  if (introDue(room, cfg.gameId)) {
    // Shown once per game per room: a rematch or a later queue entry starts straight away (R95).
    room.memory.introSeen = [...((room.memory.introSeen as GameId[] | undefined) ?? []), cfg.gameId];
    room.game.intro = { ready: [] };
    setPhase(room, 'intro', INTRO_MS, ctx);
    return;
  }
  moduleOf(cfg.gameId).start(room, ctx);
}

function afterBreak(room: RoomState, ctx: Ctx) {
  if (room.queueIndex + 1 < room.queue.length) {
    room.queueIndex += 1;
    try {
      startGame(room, ctx);
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      addNotice(room, e.message, ctx);
      endNight(room, ctx);
    }
  } else {
    endNight(room, ctx);
  }
}

function endNight(room: RoomState, ctx: Ctx) {
  room.status = 'summary';
  room.game = null;
  room.botPlan = [];
  room.paused = null;
  setPhase(room, 'summary', null, ctx);
  ctx.effects.push({ type: 'nightUpdated' });
}

function processDeadline(room: RoomState, ctx: Ctx) {
  if (room.status === 'break') return afterBreak(room, ctx);
  if (room.status === 'playing' && room.game?.intro) return beginGame(room, ctx);
  const m = gameModule(room);
  if (room.status === 'playing' && m) m.onDeadline(room, ctx);
  else room.phase.deadline = null;
}

/* ───────────────────────── catch-up (SPEC §4.3) ───────────────────────── */

/** Processes every overdue deadline and due bot action in time order (SPEC §4.3). Each step runs at its
 *  own due time (virtual clock), so several overdue turns chain exactly as if a phone had ticked each one. */
export function catchUp(room: RoomState, ctx: Ctx): void {
  autoPause(room, ctx);
  adminHandOff(room, ctx);
  const realNow = ctx.now;
  try {
    for (let step = 0; step < 50 && !room.paused; step++) {
      const deadline = room.phase.deadline;
      const bot = room.botPlan.filter((b) => b.dueAt <= realNow).sort((a, b) => a.dueAt - b.dueAt)[0];
      const deadlineDue = deadline != null && deadline <= realNow;
      if (!bot && !deadlineDue) break;
      if (bot && (!deadlineDue || bot.dueAt <= deadline!)) {
        room.botPlan = room.botPlan.filter((b) => b !== bot);
        const seat = seatById(room, bot.seatId);
        ctx.now = Math.max(bot.dueAt, room.phase.startedAt);
        if (seat && bot.phaseId === room.phase.id) {
          try {
            dispatchGame(room, seat, bot.action, ctx);
          } catch (e) {
            if (!(e instanceof GameError)) throw e;
          }
        }
        continue;
      }
      ctx.now = deadline!;
      processDeadline(room, ctx);
      planBots(room, ctx);
    }
  } finally {
    ctx.now = realNow;
  }
  planBots(room, ctx);
}

function lastHumanContact(room: RoomState, ctx: Ctx): number {
  let t = 0;
  for (const s of room.seats) if (!s.isBot && s.status !== 'kicked') t = Math.max(t, ctx.presence[s.identityId] ?? 0);
  return t;
}

/** All phones silent for too long: pause instead of fast-forwarding through turns (R20). */
function autoPause(room: RoomState, ctx: Ctx) {
  if (room.status !== 'playing' || room.paused || room.phase.deadline == null) return;
  const last = lastHumanContact(room, ctx);
  if (!last || ctx.now - last <= ctx.silencePauseMs) return;
  const remainingMs = Math.max(room.phase.deadline - last, 10_000);
  room.paused = { remainingMs, at: last };
  addNotice(room, 'Everyone went quiet, so the game paused', ctx);
}

/** Admin is gone or AFK: pass admin to the longest-present connected human (R26). */
function adminHandOff(room: RoomState, ctx: Ctx) {
  const admin = seatById(room, room.adminSeatId);
  const adminOk = admin && admin.status !== 'kicked' && !admin.afk && ctx.now - (ctx.presence[admin.identityId] ?? 0) < ctx.adminGraceMs;
  if (adminOk) return;
  const candidates = room.seats
    .filter((s) => s.status === 'seated' && !s.isBot && !s.afk && s.id !== admin?.id)
    .filter((s) => ctx.now - (ctx.presence[s.identityId] ?? 0) < ctx.adminGraceMs)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const next = candidates[0];
  if (!next) return;
  room.adminSeatId = next.id;
  addNotice(room, `${next.name} is now admin`, ctx);
}

/** Schedule the next action for each bot seat (demo, R44). */
export function planBots(room: RoomState, ctx: Ctx) {
  room.botPlan = room.botPlan.filter((b) => b.phaseId === room.phase.id);
  const m = gameModule(room);
  if (!m?.bot || room.status !== 'playing' || room.paused) return;
  for (const s of room.seats) {
    if (!s.isBot || s.status !== 'seated') continue;
    if (room.botPlan.some((b) => b.seatId === s.id)) continue;
    const plan = m.bot(room, s, ctx);
    if (plan) room.botPlan.push({ seatId: s.id, dueAt: ctx.now + plan.delayMs, phaseId: room.phase.id, action: plan.action });
  }
}

/* ───────────────────────── actions ───────────────────────── */

export function rateLimit(room: RoomState, seat: Seat, ctx: Ctx, chat: boolean) {
  const recent = (room.rate[seat.id] ?? []).filter((t) => ctx.now - t < 1000);
  if (recent.length >= 10) throw new GameError('RATE_LIMITED');
  room.rate[seat.id] = [...recent, ctx.now];
  if (chat) {
    const c = (room.chatRate[seat.id] ?? []).filter((t) => ctx.now - t < 2000);
    if (c.length >= 3) throw new GameError('RATE_LIMITED');
    room.chatRate[seat.id] = [...c, ctx.now];
  }
}

function dispatchGame(room: RoomState, seat: Seat, action: GameAction, ctx: Ctx) {
  const m = gameModule(room);
  if (!m || room.status !== 'playing') throw new GameError('WRONG_PHASE');
  if (room.paused) throw new GameError('PAUSED');
  if (seat.status !== 'seated') throw new GameError('NOT_SEATED');
  m.act(room, seat, action, ctx);
}

function validateQueue(raw: unknown, ctx: Ctx): GameConfig[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) throw new GameError('INVALID', 'Queue needs 1–10 games');
  return raw.map((item) => {
    const it = item as { gameId?: unknown; settings?: unknown };
    if (typeof it.gameId !== 'string' || !hasModule(it.gameId) || !GAME_META[it.gameId]) throw new GameError('INVALID', 'Unknown game');
    const meta = GAME_META[it.gameId];
    if (meta.testOnly && !ctx.testMode) throw new GameError('INVALID', 'Unknown game');
    return { gameId: it.gameId, settings: validateSettings(meta.settings, it.settings, ctx.testMode) };
  });
}

/** Every action from a seat goes through here (R11). Throws GameError when invalid. */
export function applyAction(room: RoomState, seat: Seat, action: GameAction, ctx: Ctx): void {
  if (seat.status === 'kicked') throw new GameError('KICKED');
  const m = gameModule(room);
  rateLimit(room, seat, ctx, Boolean(m?.chatActions?.includes(action.type)));
  // Any action from a seat proves they're here: clears AFK and the missed-turn streak (R22).
  if (seat.afk) {
    seat.afk = false;
    addNotice(room, `${seat.name} is back`, ctx);
  }
  seat.missedTurns = 0;
  const lobbyish = room.status === 'lobby' || room.status === 'break' || room.status === 'summary';

  switch (action.type) {
    case 'wave':
      if (seat.status !== 'seated') throw new GameError('NOT_SEATED');
      room.waves += 1;
      return;
    case 'imBack':
      return;
    case 'introReady': {
      // "Got it" on the How-to-play card; the game starts once every active human has tapped it (R95).
      const intro = room.game?.intro;
      if (room.status !== 'playing' || !intro) throw new GameError('WRONG_PHASE');
      if (room.paused) throw new GameError('PAUSED');
      if (seat.status !== 'seated') throw new GameError('NOT_SEATED');
      if (!intro.ready.includes(seat.id)) intro.ready.push(seat.id);
      if (activeSeats(room).every((s) => s.isBot || intro.ready.includes(s.id))) beginGame(room, ctx);
      return;
    }
    case 'setIntros':
      requireAdmin(room, seat);
      if (!lobbyish) throw new GameError('WRONG_PHASE');
      room.intros = Boolean(action.on);
      return;
    case 'setAvatar': {
      const emoji = typeof action.emoji === 'string' ? action.emoji : '';
      if (!emoji || [...emoji].length > 4) throw new GameError('INVALID');
      seat.avatar.emoji = emoji;
      return;
    }
    case 'setQueue':
      requireAdmin(room, seat);
      if (!lobbyish) throw new GameError('WRONG_PHASE'); // settings locked during a game (R27)
      room.queue = validateQueue(action.queue, ctx);
      room.queueIndex = 0;
      return;
    case 'setTeams': {
      requireAdmin(room, seat);
      if (!lobbyish) throw new GameError('WRONG_PHASE');
      setTeams(room, action, ctx);
      return;
    }
    case 'start':
      requireAdmin(room, seat);
      if (room.status === 'playing') throw new GameError('WRONG_PHASE');
      if (action.queue !== undefined) room.queue = validateQueue(action.queue, ctx);
      room.queueIndex = 0;
      startGame(room, ctx);
      addNotice(room, `${metaOf(room.game!.id).title} started`, ctx, 'admin');
      return;
    case 'demoStart': {
      // Demo rooms: one tap starts any game with short preset rules (R44).
      requireAdmin(room, seat);
      if (!room.isDemo) throw new GameError('INVALID');
      if (room.status === 'playing') throw new GameError('WRONG_PHASE');
      const gameId = action.gameId as GameId;
      if (!DEMO_GAMES.includes(gameId)) throw new GameError('INVALID');
      room.queue = [{ gameId, settings: validateSettings(metaOf(gameId).settings, demoSettings(gameId, ctx.testMode), ctx.testMode) }];
      room.queueIndex = 0;
      startGame(room, ctx);
      return;
    }
    case 'continue':
      requireAdmin(room, seat);
      if (room.status !== 'break') throw new GameError('WRONG_PHASE');
      afterBreak(room, ctx);
      return;
    case 'rematch':
      requireAdmin(room, seat);
      if (room.status !== 'break' && room.status !== 'summary') throw new GameError('WRONG_PHASE');
      if (!room.queue.length) throw new GameError('INVALID');
      // In a break: replay the game just played. From the night summary: replay the whole queue.
      // Same players and the same teams (R31).
      if (room.status === 'summary') room.queueIndex = 0;
      startGame(room, ctx);
      addNotice(room, 'Rematch!', ctx, 'admin');
      return;
    case 'newQueue':
      requireAdmin(room, seat);
      if (room.status !== 'summary' && room.status !== 'break') throw new GameError('WRONG_PHASE');
      room.status = 'lobby';
      room.game = null;
      setPhase(room, 'lobby', null, ctx);
      return;
    case 'endNight':
      requireAdmin(room, seat);
      if (room.status === 'lobby') throw new GameError('WRONG_PHASE');
      if (room.status === 'playing') finishGame(room, ctx, gameModule(room)?.stats?.(room));
      endNight(room, ctx);
      addNotice(room, 'Night ended', ctx, 'admin');
      return;
    case 'pause':
      requireAdmin(room, seat);
      if (room.status !== 'playing' || room.paused) throw new GameError('WRONG_PHASE');
      room.paused = { remainingMs: room.phase.deadline == null ? 0 : Math.max(0, room.phase.deadline - ctx.now), at: ctx.now };
      addNotice(room, 'Game paused', ctx, 'admin');
      return;
    case 'resume': {
      requireAdmin(room, seat);
      if (!room.paused) throw new GameError('WRONG_PHASE');
      const shift = ctx.now - room.paused.at;
      if (room.phase.deadline != null) room.phase.deadline = ctx.now + room.paused.remainingMs;
      if (room.phase.endsAt != null) room.phase.endsAt += shift;
      m?.shiftTimes?.(room, shift);
      for (const b of room.botPlan) b.dueAt += shift;
      room.paused = null;
      addNotice(room, 'Game resumed', ctx, 'admin');
      return;
    }
    case 'skip':
      requireAdmin(room, seat);
      if (room.status !== 'playing' || room.paused) throw new GameError('WRONG_PHASE');
      ctx.skipping = true;
      try {
        processDeadline(room, ctx);
      } finally {
        ctx.skipping = false;
      }
      addNotice(room, 'Admin skipped the turn', ctx, 'admin');
      return;
    case 'endGame':
      requireAdmin(room, seat);
      if (room.status !== 'playing') throw new GameError('WRONG_PHASE');
      addNotice(room, `Admin ended ${metaOf(room.game!.id).title}`, ctx, 'admin');
      finishGame(room, ctx, gameModule(room)?.stats?.(room));
      return;
    case 'undo':
      requireAdmin(room, seat);
      if (room.status !== 'playing' && room.status !== 'break') throw new GameError('WRONG_PHASE');
      if (!undoLastScore(room)) throw new GameError('INVALID', 'Nothing to undo');
      addNotice(room, 'Admin undid the last score', ctx, 'admin');
      return;
    case 'kick': {
      requireAdmin(room, seat);
      const target = seatById(room, action.seatId as string);
      if (!target || target.id === seat.id || target.status === 'kicked') throw new GameError('INVALID');
      target.status = 'kicked';
      target.seatAtNextRound = false;
      for (const t of room.teams ?? []) t.seatIds = t.seatIds.filter((id) => id !== target.id);
      room.pendingClaims = room.pendingClaims.filter((c) => c.seatId !== target.id);
      room.botPlan = room.botPlan.filter((b) => b.seatId !== target.id);
      addNotice(room, `${target.name} was removed by the admin`, ctx, 'admin');
      if (m && room.status === 'playing') m.seatRemoved?.(room, target.id, ctx);
      return;
    }
    case 'transferAdmin': {
      requireAdmin(room, seat);
      const target = seatById(room, action.seatId as string);
      if (!target || target.status !== 'seated' || target.isBot || target.id === seat.id) throw new GameError('INVALID');
      room.adminSeatId = target.id;
      addNotice(room, `${target.name} is now admin`, ctx, 'admin');
      return;
    }
    case 'approveClaim':
    case 'denyClaim': {
      const claim = room.pendingClaims.find((c) => c.seatId === action.seatId);
      if (!claim) throw new GameError('INVALID');
      const claimedSeat = seatById(room, claim.seatId)!;
      // The admin approves; if the admin's own seat is claimed, any other seated human may approve.
      const canApprove = room.adminSeatId === seat.id ? claimedSeat.id !== seat.id : claimedSeat.id === room.adminSeatId && seat.id !== claimedSeat.id && !seat.isBot;
      if (!canApprove) throw new GameError('NOT_ADMIN');
      room.pendingClaims = room.pendingClaims.filter((c) => c !== claim);
      if (action.type === 'approveClaim') {
        claimedSeat.identityId = claim.claimantIdentityId;
        claimedSeat.deviceId = null;
        claimedSeat.missedTurns = 0;
        addNotice(room, `${claimedSeat.name}'s seat moved to a new device`, ctx, 'admin');
      }
      return;
    }
    default:
      dispatchGame(room, seat, action, ctx);
  }
}

/** Seat strengths for balancing: stored ratings (never client-supplied) for the next team game. */
function strengths(room: RoomState, ctx: Ctx, gameId: GameId | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of seated(room)) out[s.id] = strengthFor(ctx.ratings?.[s.identityId], gameId);
  return out;
}

function nextTeamGame(room: RoomState): GameId | null {
  const cfg = room.queue.slice(room.queueIndex).find((q) => GAME_META[q.gameId]?.teams !== 'none');
  return cfg?.gameId ?? null;
}

function setTeams(room: RoomState, action: GameAction, ctx: Ctx) {
  const players = seated(room);
  if (action.mode === 'balance' || action.mode === 'shuffle') {
    const n = Number(action.count ?? room.teams?.length ?? 2);
    if (!Number.isInteger(n) || n < 2 || n > 4 || n > players.length) throw new GameError('INVALID');
    room.teams = balanceTeams(players, n, strengths(room, ctx, nextTeamGame(room)), ctx, action.mode === 'shuffle');
  } else if (action.mode === 'move') {
    if (!room.teams) throw new GameError('INVALID');
    const s = seatById(room, action.seatId as string);
    const to = room.teams.find((t) => t.id === action.teamId);
    if (!s || !to || s.status !== 'seated') throw new GameError('INVALID');
    for (const t of room.teams) t.seatIds = t.seatIds.filter((id) => id !== s.id);
    to.seatIds.push(s.id);
  } else if (action.mode === 'clear') {
    room.teams = null;
  } else throw new GameError('INVALID');
  for (const s of room.seats) s.teamId = room.teams?.find((t) => t.seatIds.includes(s.id))?.id ?? null;
}

/* ───────────────────────── views ───────────────────────── */

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

export function publicView(room: RoomState, presence: Record<string, number>, now: number, presenceMs = PRESENCE_MS) {
  const m = gameModule(room);
  const strip = (g: RoomState['lastGame']) =>
    g && { ...g, rows: g.rows.map(({ identityId: _identityId, ...r }) => r) };
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
        connected: s.isBot || now - (presence[s.identityId] ?? 0) < presenceMs,
        joinedAt: s.joinedAt,
      })),
    teams: room.teams,
    teamScores: room.teamScores,
    queue: room.queue,
    queueIndex: room.queueIndex,
    phase: room.phase,
    paused: room.paused,
    notices: room.notices,
    waves: room.waves,
    game: room.game
      ? {
          id: room.game.id,
          gameNo: room.game.gameNo,
          settings: room.game.settings,
          view: (m ? m.publicView(room) : null) as any,
          intro: room.game.intro ? { ready: room.game.intro.ready } : null,
        }
      : null,
    intros: room.intros !== false,
    lastGame: strip(room.lastGame),
    night: room.finished.map((g) => ({ gameNo: g.gameNo, gameId: g.gameId, rows: g.rows.map(({ identityId: _i, ...r }) => r) })),
    pendingClaims: room.pendingClaims.map((c) => ({ seatId: c.seatId, claimantName: c.claimantName })),
    awards: room.status === 'summary' ? computeAwards(room.finished) : [],
    undoAvailable: room.scoreEvents.some((e) => !e.undone),
    nextWakeAt: nextWakeAt(room),
  };
}

export type PublicView = ReturnType<typeof publicView>;

export function nextWakeAt(room: RoomState): number | null {
  if (room.paused) return null;
  const times = [room.phase.deadline, ...room.botPlan.map((b) => b.dueAt)].filter((t): t is number => typeof t === 'number');
  return times.length ? Math.min(...times) : null;
}

export function privateView(room: RoomState, viewer: Viewer) {
  const seat = viewer.kind === 'player' || viewer.kind === 'spectator' ? room.seats.find((s) => s.id === viewer.seatId) : undefined;
  const m = gameModule(room);
  const intro = room.game?.intro;
  const game = m
    ? m.privateView(room, seat && seat.status === 'seated' ? seat : null)
    : intro
      ? { mustAct: false, introReady: Boolean(seat && intro.ready.includes(seat.id)) }
      : null;
  return {
    seatId: seat?.id ?? null,
    role: (seat ? (seat.status === 'seated' ? 'player' : seat.status) : viewer.kind === 'screen' ? 'screen' : 'none') as
      | 'player'
      | 'spectator'
      | 'kicked'
      | 'screen'
      | 'none',
    isAdmin: Boolean(seat && room.adminSeatId === seat.id),
    deviceId: seat?.deviceId ?? null,
    game: game as ({ mustAct: boolean } & Record<string, any>) | null,
  };
}

export type PrivateView = ReturnType<typeof privateView>;

/** Seats whose private view changed between two states (SPEC §4.2 privateFor). */
export function privateChanges(before: RoomState, after: RoomState): string[] {
  const out: string[] = [];
  for (const s of after.seats) {
    const v: Viewer = s.status === 'seated' ? { kind: 'player', seatId: s.id } : { kind: 'spectator', seatId: s.id };
    if (JSON.stringify(privateView(before, v)) !== JSON.stringify(privateView(after, v))) out.push(s.id);
  }
  return out;
}

export function viewerFor(room: RoomState, identityIds: string[], screen = false): Viewer {
  if (screen) return { kind: 'screen' };
  const seat = seatOf(room, identityIds);
  if (!seat) return { kind: 'public' };
  return seat.status === 'seated' ? { kind: 'player', seatId: seat.id } : { kind: 'spectator', seatId: seat.id };
}

export { activeSeats, award };
