import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { requireSeat, roomOp } from '@/server/rooms';
import { codeFrom, type CodeParams } from '@/server/params';
import { isMember } from '@/server/crews';
import { q } from '@/server/db';
import { addNotice } from '@/engine/core';
import { GameError } from '@/engine/types';

/** Links the room to one of the admin's crews (R48); results then flow into that crew's records. */
export async function POST(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const crewId = body.crewId === null ? null : String(body.crewId ?? '');
    if (crewId && !(await isMember(crewId, identity))) return fail('NOT_ADMIN', { message: 'You are not in that crew' });
    const crewName = crewId ? (await q<{ name: string }>('select name from crews where id = $1', [crewId]))[0]?.name : null;
    const out = await roomOp(code, identity, (room, ctx) => {
      const seat = requireSeat(room, identity);
      if (room.adminSeatId !== seat.id) throw new GameError('NOT_ADMIN');
      room.crewId = crewId;
      addNotice(room, crewId ? `Tonight counts for ${crewName}` : 'Room unlinked from the crew', ctx, 'admin');
      return room.roomId;
    });
    await q('update rooms set crew_id = $2 where id = $1', [out.result, crewId]);
    return ok({ v: out.room.v });
  });
}
