import 'server-only';
import { normalizeCode } from '@/lib/codes';
import { GameError } from '@/engine/types';

export type CodeParams = { params: Promise<{ code: string }> };

export async function codeFrom(ctx: CodeParams): Promise<string> {
  const code = normalizeCode((await ctx.params).code);
  if (!code) throw new GameError('ROOM_NOT_FOUND');
  return code;
}
