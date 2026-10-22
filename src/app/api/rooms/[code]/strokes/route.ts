import { getIdentity } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { codeFrom, type CodeParams } from '@/server/params';
import { appendStrokes, readStrokes } from '@/server/strokes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const identity = await getIdentity();
    if (!identity) return fail('UNAUTHORIZED');
    const body = await readJson(req);
    const out = await appendStrokes(code, identity, { turnId: body.turnId, seq: body.seq, ops: body.ops });
    return ok(out);
  });
}

export async function GET(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const url = new URL(req.url);
    const turnId = url.searchParams.get('turnId') ?? '';
    const after = Number(url.searchParams.get('after') ?? '-1');
    const batches = await readStrokes(code, turnId, Number.isFinite(after) ? after : -1);
    return ok({ batches });
  });
}
