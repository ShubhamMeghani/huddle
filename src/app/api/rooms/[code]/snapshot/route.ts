import { handle } from '@/server/http';
import { codeFrom, type CodeParams } from '@/server/params';
import { touch } from '@/server/touch';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, params: CodeParams) {
  return handle(async () => touch(await codeFrom(params), true, req.headers.get('x-huddle-screen') === '1'));
}
