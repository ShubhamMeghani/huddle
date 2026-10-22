import type { RoomState, Seat } from './types';

/** Who may post strokes for a turn. Phase 1: the admin may sketch in the lobby (used by the
 *  throughput probe); Draw & Guess (Phase 5) adds the current drawer. */
export function canDraw(room: RoomState, seat: Seat, turnId: string): boolean {
  if (room.status === 'lobby') return turnId === 'lobby' && room.adminSeatId === seat.id;
  return false;
}
