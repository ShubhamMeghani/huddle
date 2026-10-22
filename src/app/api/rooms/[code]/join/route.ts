import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { roomOp } from '@/server/rooms';
import { codeFrom, type CodeParams } from '@/server/params';
import { joinRoom } from '@/engine/room';

export async function POST(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const out = await roomOp(code, identity, (room, ctx) => {
      const deviceId = req.headers.get('x-huddle-device')?.slice(0, 64) || null;
      const seat = joinRoom(room, { identityIds: identity.aliases, identityId: identity.id, name: identity.name, deviceId }, ctx, {
        spectate: body.spectate === true,
      });
      return { seatId: seat.id, status: seat.status };
    });
    return ok({ v: out.room.v, ...out.result });
  });
}
