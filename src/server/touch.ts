import 'server-only';
import { getIdentity } from './identity';
import { peekRoom, roomOp, snapshotFor } from './rooms';
import { realtimeDriverName, isTestMode, presenceMs } from './env';
import { channelName } from './realtime';
import { ok } from './http';
import { cookies } from 'next/headers';
import { SCREEN_COOKIE } from './identity';
import type { RoomState } from '@/engine/types';

/** Screen cookie = "<roomId>.<token>"; valid only for that room and a token it registered. */
export function isScreenFor(room: RoomState, cookie: string | undefined): boolean {
  if (!cookie) return false;
  const [roomId, token] = cookie.split('.');
  return roomId === room.roomId && Boolean(token) && (room.screens ?? []).includes(token);
}

/** Snapshot, tick and heartbeat share one path: catch-up + presence, then the viewer's view. */
export async function touch(code: string, withView: boolean, wantsScreen = false) {
  const identity = await getIdentity();
  const screenCookie = (await cookies()).get(SCREEN_COOKIE)?.value;
  // A registered big screen views the room display-only, even if this browser also has a player identity.
  const who = wantsScreen ? null : identity;
  const out = (await peekRoom(code, who)) ?? (await roomOp(code, who, () => null));
  const screen = wantsScreen && isScreenFor(out.room, screenCookie);
  if (!withView) return ok({ v: out.room.v });
  return ok({
    ...snapshotFor(out.room, out.presence, identity, screen),
    realtime: { driver: realtimeDriverName(), channel: channelName(out.room.roomId) },
    testMode: isTestMode(),
    heartbeatMs: Math.max(1000, Math.floor(presenceMs() / 3)),
  });
}
