import { handle } from '@/server/http';
import { codeFrom, type CodeParams } from '@/server/params';
import { touch } from '@/server/touch';

export async function POST(_req: Request, params: CodeParams) {
  return handle(async () => touch(await codeFrom(params), false));
}
