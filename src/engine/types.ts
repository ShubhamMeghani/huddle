/* Shared, pure data model for a room (SPEC §4.1). No I/O here. */

export type GameId = 'ping' | 'quiz' | 'draw' | 'imposter' | 'atlas' | 'charades' | 'mlt';
export type SeatId = string;

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'KICKED'
  | 'NOT_ADMIN'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'INVALID'
  | 'RATE_LIMITED'
  | 'PAUSED'
  | 'UNAUTHORIZED'
  | 'NOT_SEATED';

export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface Avatar {
  color: number; // index into the 12-colour avatar palette
  emoji: string;
}

export interface Seat {
  id: SeatId;
  identityId: string;
  name: string;
  avatar: Avatar;
  joinedAt: number;
  status: 'seated' | 'spectator' | 'kicked';
  seatAtNextRound: boolean;
  missedTurns: number;
  afk: boolean;
  afkSkips: number;
  isBot: boolean;
  teamId: string | null;
  score: number;
  /** The device currently holding this seat (a signed-in user may move between devices). */
  deviceId: string | null;
}

export interface Team {
  id: string;
  name: string;
  seatIds: SeatId[];
}

export interface Phase {
  id: number;
  kind: string;
  deadline: number | null;
  startedAt: number;
  durationMs: number | null;
  /** Seat whose turn this phase is (AFK accounting); null for simultaneous phases. */
  turnSeatId: SeatId | null;
}

export interface GameConfig {
  gameId: GameId;
  settings: Record<string, unknown>;
}

export interface ScoreEvent {
  id: number;
  target: { seatId?: SeatId; teamId?: string };
  points: number;
  reason: string;
  undone: boolean;
}

export interface Notice {
  id: number;
  at: number;
  text: string;
  kind: 'admin' | 'system';
}

export interface BotPlanItem {
  seatId: SeatId;
  dueAt: number;
  phaseId: number;
  action: GameAction;
}

export interface GameAction {
  type: string;
  [k: string]: unknown;
}

export interface FinishedGame {
  gameNo: number;
  gameId: GameId;
  settings: Record<string, unknown>;
  startedAt: number;
  endedAt: number;
  teamGame: boolean;
  /** Final standings, one row per participating seat. */
  rows: {
    seatId: SeatId;
    identityId: string;
    name: string;
    teamId: string | null;
    score: number;
    rank: number;
    placementPoints: number;
    stats: Record<string, number>;
  }[];
}

export interface PendingClaim {
  seatId: SeatId;
  claimantIdentityId: string;
  claimantName: string;
  at: number;
}

export interface RoomState {
  v: number;
  roomId: string;
  code: string;
  isDemo: boolean;
  crewId: string | null;
  createdAt: number;
  status: 'lobby' | 'playing' | 'break' | 'summary';
  adminSeatId: SeatId | null;
  seats: Seat[];
  seatCounter: number;
  teams: Team[] | null;
  queue: GameConfig[];
  queueIndex: number;
  phase: Phase;
  paused: { remainingMs: number; at: number } | null;
  game: {
    id: GameId;
    gameNo: number;
    settings: Record<string, unknown>;
    startedAt: number;
    state: any;
  } | null;
  gameCounter: number;
  scoreEvents: ScoreEvent[];
  scoreEventCounter: number;
  teamScores: Record<string, number>;
  finished: FinishedGame[];
  lastGame: FinishedGame | null;
  rngSeed: string;
  rngCounter: number;
  botPlan: BotPlanItem[];
  notices: Notice[];
  noticeCounter: number;
  pendingClaims: PendingClaim[];
  /** Lobby "wave" counter: the Phase 1 skeleton action. */
  waves: number;
  /** Rate limiting: per-seat recent action timestamps (pruned). */
  rate: Record<SeatId, number[]>;
  chatRate: Record<SeatId, number[]>;
}

export type Effect =
  | { type: 'gameEnded'; game: FinishedGame }
  | { type: 'nightUpdated' }
  | { type: 'placeSuggestion'; name: string; accepted: boolean }
  | { type: 'clearStrokes'; turnId: string }
  | { type: 'strokes'; turnId: string; seq: number; ops: unknown[] }
  | { type: 'questionUsed'; questionId: string };

export interface Presence {
  /** identityId -> last seen epoch ms */
  [identityId: string]: number;
}

export interface Ctx {
  now: number;
  rng: () => number;
  effects: Effect[];
  /** Private feedback for the acting viewer only (e.g. "you're close"). */
  private: Record<string, unknown> | null;
  presence: Presence;
  testMode: boolean;
  adminGraceMs: number;
  silencePauseMs: number;
  breakMs: number;
  /** A seat counts as connected if seen within this window (60 s; shorter in test mode). */
  presenceMs: number;
  /** Set while an admin skip forces a deadline: missed-turn (AFK) accounting is suppressed. */
  skipping?: boolean;
}

export type Viewer =
  | { kind: 'player'; seatId: SeatId }
  | { kind: 'spectator'; seatId: SeatId }
  | { kind: 'screen' }
  | { kind: 'public' };
