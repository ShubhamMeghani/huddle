import { getIdentity } from '@/server/identity';
import { fail, handle, ok } from '@/server/http';
import { crewHeadToHead } from '@/server/crews';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const a = url.searchParams.get('a') ?? '';
    const b = url.searchParams.get('b') ?? '';
    return ok({ h2h: await crewHeadToHead(id, identity, a, b) });
  });
}
