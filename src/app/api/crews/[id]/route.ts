import { getIdentity } from '@/server/identity';
import { fail, handle, ok } from '@/server/http';
import { crewOverview } from '@/server/crews';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('ROOM_NOT_FOUND');
    const season = new URL(req.url).searchParams.get('season') ?? undefined;
    return ok(await crewOverview(id, identity, season));
  });
}
