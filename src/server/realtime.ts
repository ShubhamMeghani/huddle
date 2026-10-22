import 'server-only';
import { EventEmitter } from 'node:events';
import * as Ably from 'ably';
import { realtimeDriverName, requireEnv } from './env';

export function channelName(roomId: string): string {
  return `huddle:room:${roomId}`;
}

/* Local driver: in-process pub/sub served over SSE (test mode and CI only). */
declare global {
  var __huddleBus: EventEmitter | undefined;
  var __huddleAbly: Ably.Rest | undefined;
}
export function localBus(): EventEmitter {
  if (!globalThis.__huddleBus) {
    globalThis.__huddleBus = new EventEmitter();
    globalThis.__huddleBus.setMaxListeners(0);
  }
  return globalThis.__huddleBus;
}

function ablyRest(): Ably.Rest {
  if (!globalThis.__huddleAbly) globalThis.__huddleAbly = new Ably.Rest({ key: requireEnv('ABLY_API_KEY') });
  return globalThis.__huddleAbly;
}

export async function publish(roomId: string, name: 'state' | 'strokes', data: unknown): Promise<void> {
  const channel = channelName(roomId);
  if (realtimeDriverName() === 'local') {
    localBus().emit(channel, { name, data });
    return;
  }
  try {
    await ablyRest().channels.get(channel).publish(name, data);
  } catch (e) {
    // Publish failures are recoverable: clients resync via version gaps and heartbeats (SPEC §4.2).
    console.error('realtime publish failed', e instanceof Error ? e.message : e);
  }
}

/** Subscribe-only token request for one room's public channel (R4). */
export async function tokenRequest(roomId: string, clientId: string, key = requireEnv('ABLY_API_KEY')) {
  const rest = new Ably.Rest({ key });
  return rest.auth.createTokenRequest({
    clientId,
    capability: JSON.stringify({ [channelName(roomId)]: ['subscribe'] }),
    ttl: 60 * 60 * 1000,
  });
}
