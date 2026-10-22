import 'server-only';
import type { Tx } from './db';
import type { Effect, RoomState } from '@/engine/types';

/** Side effects produced by the pure engine, persisted inside the same transaction. */
export async function applyEffects(c: Tx, room: RoomState, effects: Effect[]): Promise<void> {
  for (const e of effects) {
    switch (e.type) {
      case 'clearStrokes':
        await c.query('delete from strokes where room_id = $1 and turn_id = $2', [room.roomId, e.turnId]);
        break;
      default:
        // Later phases persist game results, nights and place suggestions here.
        break;
    }
  }
}
