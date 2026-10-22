import { expect, test } from 'vitest';
import { q } from '@/server/db';
import { createRoom, roomOp } from '@/server/rooms';
import { makeIdentity } from '../helpers/unit-room';

test('AC-10 a room idle for 24 h 1 min is not found, its code is reusable and its results remain', async () => {
  const id = await makeIdentity('Expiring');
  const { code, roomId } = await createRoom({ identity: id, code: 'XXEX' });
  await q(
    `insert into games (room_id, game_no, game_type, settings, started_at, ended_at) values ($1, 1, 'ping', '{}', now(), now())`,
    [roomId],
  );
  await q(
    `update rooms set last_activity_at = now() - interval '24 hours 1 minute', expires_at = now() - interval '1 minute' where id = $1`,
    [roomId],
  );
  await expect(roomOp(code, id, () => null)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  const again = await createRoom({ identity: id, code: 'XXEX' });
  expect(again.code).toBe('XXEX');
  expect(again.roomId).not.toBe(roomId);
  const games = await q('select game_type from games where room_id = $1', [roomId]);
  expect(games).toHaveLength(1);
});
