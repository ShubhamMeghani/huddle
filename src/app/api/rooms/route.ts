import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { createRoom } from '@/server/rooms';
import { isTestMode } from '@/server/env';
import { isMember } from '@/server/crews';

export async function POST(req: Request) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const seed = isTestMode() ? req.headers.get('x-huddle-seed') ?? undefined : undefined;
    const crewId = typeof body.crewId === 'string' ? body.crewId : null;
    if (crewId && !(await isMember(crewId, identity))) return fail('NOT_ADMIN', { message: 'You are not in that crew' });
    const { code } = await createRoom({ identity, seed, crewId });
    return ok({ code });
  });
}
