import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { handle, ok } from '@/server/http';
import { roomOp } from '@/server/rooms';
import { codeFrom, type CodeParams } from '@/server/params';
import { SCREEN_COOKIE } from '@/server/identity';
import { isScreenFor } from '@/server/touch';
import { MAX_SCREENS } from '@/engine/room';
import { GameError } from '@/engine/types';

/** Registers this browser as a display-only big screen for the room (R54). Not a player. */
export async function POST(_req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const existing = (await cookies()).get(SCREEN_COOKIE)?.value;
    const token = randomBytes(12).toString('base64url');
    const out = await roomOp(
      code,
      null,
      (room) => {
        if (isScreenFor(room, existing)) return existing!;
        room.screens = [...(room.screens ?? [])];
        if (room.screens.length >= MAX_SCREENS) throw new GameError('ROOM_FULL', 'This room already has two big screens');
        room.screens.push(token);
        return `${room.roomId}.${token}`;
      },
      { touchPresence: false },
    );
    const https = ((await headers()).get('x-forwarded-proto') ?? '').includes('https');
    (await cookies()).set(SCREEN_COOKIE, out.result, { httpOnly: true, sameSite: 'lax', secure: https, path: '/', maxAge: 60 * 60 * 24 });
    return ok({ v: out.room.v });
  });
}
