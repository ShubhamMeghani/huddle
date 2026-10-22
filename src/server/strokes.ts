import 'server-only';
import { q } from './db';
import { publish } from './realtime';
import { GameError, type RoomState, type Seat } from '@/engine/types';
import { seatOf } from '@/engine/room';
import type { Identity } from './identity';
import { canDraw } from '@/engine/draw-access';
import { validOps } from '@/lib/strokes';

export const MAX_BATCH_BYTES = 8 * 1024;
export const MAX_BATCHES_PER_SEC = 8;

async function liveRoom(code: string): Promise<{ id: string; state: RoomState }> {
  const rows = await q<{ id: string; state: RoomState }>(
    'select id, state from rooms where code = $1 and ended_at is null and expires_at > now()',
    [code],
  );
  if (!rows[0]) throw new GameError('ROOM_NOT_FOUND');
  return rows[0];
}

/** Append one stroke batch (SPEC §4.5). Does not lock or version the room state row. */
export async function appendStrokes(
  code: string,
  identity: Identity,
  body: { turnId: unknown; seq: unknown; ops: unknown },
): Promise<{ inserted: boolean }> {
  const { id, state } = await liveRoom(code);
  const seat: Seat | undefined = seatOf(state, identity.aliases);
  if (!seat || seat.status === 'kicked') throw new GameError('NOT_SEATED');
  const turnId = typeof body.turnId === 'string' ? body.turnId : '';
  const seq = Number(body.seq);
  if (!turnId || !Number.isInteger(seq) || seq < 0 || !validOps(body.ops)) throw new GameError('INVALID');
  if (!canDraw(state, seat, turnId)) throw new GameError('NOT_YOUR_TURN');
  const json = JSON.stringify(body.ops);
  if (Buffer.byteLength(json) > MAX_BATCH_BYTES) throw new GameError('INVALID', 'Batch too large');
  const recent = await q<{ n: string }>(
    "select count(*)::text as n from strokes where room_id = $1 and created_at > now() - interval '1 second'",
    [id],
  );
  if (Number(recent[0].n) >= MAX_BATCHES_PER_SEC) throw new GameError('RATE_LIMITED');
  const ins = await q(
    'insert into strokes (room_id, turn_id, seq, ops) values ($1, $2, $3, $4) on conflict do nothing returning seq',
    [id, turnId, seq, json],
  );
  if (ins.length) await publish(id, 'strokes', { turnId, seq, ops: body.ops });
  return { inserted: ins.length > 0 };
}

export async function readStrokes(code: string, turnId: string, after: number) {
  const { id } = await liveRoom(code);
  return q<{ seq: number; ops: unknown[] }>(
    'select seq, ops from strokes where room_id = $1 and turn_id = $2 and seq > $3 order by seq',
    [id, turnId, after],
  );
}
