import 'server-only';
import { getIdentity } from './identity';
import { roomOp, snapshotFor } from './rooms';
import { realtimeDriverName, isTestMode, presenceMs } from './env';
import { channelName } from './realtime';
import { ok } from './http';
import { cookies } from 'next/headers';
import { SCREEN_COOKIE } from './identity';

/** Snapshot, tick and heartbeat share one path: catch-up + presence, then the viewer's view. */
export async function touch(code: string, withView: boolean) {
  const identity = await getIdentity();
  const screenRoom = (await cookies()).get(SCREEN_COOKIE)?.value;
  const out = await roomOp(code, identity, () => null);
  const screen = Boolean(screenRoom && screenRoom === out.room.roomId && !identity);
  if (!withView) return ok({ v: out.room.v });
  return ok({
    ...snapshotFor(out.room, out.presence, identity, screen),
    realtime: { driver: realtimeDriverName(), channel: channelName(out.room.roomId) },
    testMode: isTestMode(),
    heartbeatMs: Math.max(1000, Math.floor(presenceMs() / 3)),
  });
}
