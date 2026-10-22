/* Helpers for DB-backed unit tests of the room pipeline. */
import { randomUUID } from 'node:crypto';
import { q } from '@/server/db';
import { createRoom, roomOp } from '@/server/rooms';
import { joinRoom } from '@/engine/room';
import type { Identity } from '@/server/identity';
import type { RoomState } from '@/engine/types';

export async function makeIdentity(name: string): Promise<Identity> {
  const id = randomUUID();
  await q("insert into identities (id, kind, display_name, device_token_hash) values ($1, 'guest', $2, $3)", [id, name, randomUUID()]);
  return { id, kind: 'guest', name, aliases: [id], guestId: id };
}

export async function roomWith(names: string[], seed = 'seed'): Promise<{ code: string; ids: Identity[] }> {
  const ids = await Promise.all(names.map(makeIdentity));
  const { code } = await createRoom({ identity: ids[0], seed });
  for (const id of ids.slice(1)) {
    await roomOp(code, id, (room, ctx) => joinRoom(room, { identityIds: id.aliases, identityId: id.id, name: id.name }, ctx));
  }
  return { code, ids };
}

export async function loadRoom(code: string): Promise<{ state: RoomState; version: number }> {
  const rows = await q<{ state: RoomState; version: number }>(
    'select state, version from rooms where code = $1 and ended_at is null',
    [code],
  );
  return rows[0];
}
