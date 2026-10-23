import { getIdentity } from '@/server/identity';
import { fail, handle, ok } from '@/server/http';
import { crewByInvite, joinCrew } from '@/server/crews';

export const dynamic = 'force-dynamic';

type P = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: P) {
  return handle(async () => {
    const crew = await crewByInvite((await ctx.params).token);
    return ok({ crew: { id: crew.id, name: crew.name } });
  });
}

export async function POST(_req: Request, ctx: P) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const crew = await joinCrew((await ctx.params).token, identity);
    return ok({ crew: { id: crew.id, name: crew.name } });
  });
}
