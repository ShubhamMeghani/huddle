import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { reportQuestion } from '@/server/reports';

const REASONS = ['wrong_answer', 'unclear', 'offensive', 'outdated', 'other'];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const { id } = await ctx.params;
    const body = await readJson(req);
    const reason = typeof body.reason === 'string' && REASONS.includes(body.reason) ? body.reason : null;
    if (!/^[a-z]{2}\d{3}$/.test(id) || !reason) return fail('INVALID');
    const stored = await reportQuestion(id, identity.id, reason);
    return ok({ stored });
  });
}
