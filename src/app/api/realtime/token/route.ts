import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getIdentity, SCREEN_COOKIE } from '@/server/identity';
import { fail, handle } from '@/server/http';
import { q } from '@/server/db';
import { tokenRequest } from '@/server/realtime';
import { normalizeCode } from '@/lib/codes';
import { seatOf } from '@/engine/room';
import type { RoomState } from '@/engine/types';
import { isScreenFor } from '@/server/touch';

export const dynamic = 'force-dynamic';

/** Ably authUrl endpoint: a subscribe-only TokenRequest for one room's public channel (R4). */
export async function GET(req: Request) {
  return handle(async () => {
    const code = normalizeCode(new URL(req.url).searchParams.get('code'));
    if (!code) return fail('ROOM_NOT_FOUND');
    const rows = await q<{ id: string; state: RoomState }>(
      'select id, state from rooms where code = $1 and ended_at is null and expires_at > now()',
      [code],
    );
    if (!rows[0]) return fail('ROOM_NOT_FOUND');
    const identity = await getIdentity();
    const screen = isScreenFor(rows[0].state, (await cookies()).get(SCREEN_COOKIE)?.value);
    if (!identity && !screen) return fail('UNAUTHORIZED');
    const seat = identity ? seatOf(rows[0].state, identity.aliases) : undefined;
    if (!screen && (!seat || seat.status === 'kicked')) {
      return NextResponse.json({ ok: false, code: 'NOT_SEATED' }, { status: 403 });
    }
    const tr = await tokenRequest(rows[0].id, identity?.id ?? `screen-${rows[0].id}`);
    return NextResponse.json(tr, { headers: { 'Cache-Control': 'no-store' } });
  });
}
