'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RoomSync, type SyncState } from './sync';

const EMPTY: SyncState = { snapshot: null, connection: 'connecting', error: null, testMode: false };

export function useRoomSync(code: string, screen = false): { sync: RoomSync; state: SyncState } {
  const sync = useMemo(() => new RoomSync(code, { screen }), [code, screen]);
  useEffect(() => {
    void sync.start();
    return () => sync.stop();
  }, [sync]);
  const state = useSyncExternalStore(
    (fn) => sync.subscribe(fn),
    () => sync.state,
    () => EMPTY,
  );
  return { sync, state };
}

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
