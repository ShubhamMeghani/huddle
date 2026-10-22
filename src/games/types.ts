/* The pure game-module interface (SPEC §4.1). Modules mutate the cloned room passed in and throw
 * GameError for invalid actions; the engine handles persistence, AFK, admin and views. */
import type { Ctx, GameAction, GameId, RoomState, Seat, SeatId } from '@/engine/types';

export interface GameModule {
  id: GameId;
  /** Action types that count as chat for rate limiting (R46). */
  chatActions?: string[];
  start(room: RoomState, ctx: Ctx): void;
  act(room: RoomState, seat: Seat, action: GameAction, ctx: Ctx): void;
  onDeadline(room: RoomState, ctx: Ctx): void;
  /** Safe for every viewer: never contains secrets (R34, R35). */
  publicView(room: RoomState): unknown;
  /** Only what this seat may see; `null` = big screen / non-player (public-only). */
  privateView(room: RoomState, seat: Seat | null): { mustAct: boolean; [k: string]: unknown };
  /** Next action for a bot seat, if any (demo, R44). */
  bot?(room: RoomState, seat: Seat, ctx: Ctx): { delayMs: number; action: GameAction } | null;
  /** The game was paused for `ms`: shift any absolute times kept in game state. */
  shiftTimes?(room: RoomState, ms: number): void;
  /** A seat was kicked mid-game: repair turn order etc. */
  seatRemoved?(room: RoomState, seatId: SeatId, ctx: Ctx): void;
  /** Per-seat stats recorded in game_results (awards, crew stats). */
  stats?(room: RoomState): Record<SeatId, Record<string, number>>;
}
