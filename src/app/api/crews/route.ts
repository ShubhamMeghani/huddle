import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { createCrew, crewsOf } from '@/server/crews';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return ok({ crews: [] });
    return ok({ crews: await crewsOf(identity) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const crew = await createCrew(identity, String(body.name ?? ''));
    return ok({ crew });
  });
}
