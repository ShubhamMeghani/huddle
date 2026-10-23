import { randomUUID } from 'node:crypto';
import { getIdentity } from '@/server/identity';
import { fail, handle, ok } from '@/server/http';
import { createRoom } from '@/server/rooms';
import { joinRoom } from '@/engine/room';
import { DEMO_BOTS } from '@/games/demo';

/** A fresh demo room: the visitor is admin, with four bot players (R43). */
export async function POST() {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const { code } = await createRoom({
      identity,
      isDemo: true,
      setup: (room, ctx) => {
        for (const name of DEMO_BOTS) {
          const id = `bot:${randomUUID()}`;
          joinRoom(room, { identityIds: [id], identityId: id, name, isBot: true }, ctx);
        }
      },
    });
    return ok({ code });
  });
}
