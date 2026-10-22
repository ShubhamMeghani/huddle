import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { requireSeat, roomOp } from '@/server/rooms';
import { codeFrom, type CodeParams } from '@/server/params';
import { applyAction } from '@/engine/room';
import { GameError } from '@/engine/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const actionId = typeof body.actionId === 'string' && UUID.test(body.actionId) ? body.actionId : null;
    const type = typeof body.type === 'string' ? body.type : null;
    if (!actionId || !type) return fail('INVALID', { message: 'actionId (uuid) and type are required' });
    const payload = body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : {};
    try {
      const out = await roomOp(
        code,
        identity,
        (room, ctx) => {
          const seat = requireSeat(room, identity);
          applyAction(room, seat, { ...payload, type }, ctx);
          return null;
        },
        { actionId, type },
      );
      return ok({ v: out.room.v, private: out.private, replayed: Boolean(out.replayed) });
    } catch (e) {
      if (e instanceof GameError) return fail(e.code, { message: e.message });
      throw e;
    }
  });
}
