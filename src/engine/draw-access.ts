import type { RoomState, Seat } from './types';

/** Who may post strokes for a turn: the current drawer during the drawing phase of Draw & Guess.
 *  In the lobby the admin may sketch under turnId "lobby" (used by the throughput probe). */
export function canDraw(room: RoomState, seat: Seat, turnId: string): boolean {
  if (room.status === 'lobby') return turnId === 'lobby' && room.adminSeatId === seat.id;
  if (room.status !== 'playing' || room.game?.id !== 'draw' || room.paused) return false;
  const s = room.game.state as { drawerId: string | null; turnId: string };
  return room.phase.kind === 'draw' && s.drawerId === seat.id && s.turnId === turnId;
}
