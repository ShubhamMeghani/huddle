'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getJson, postJson, type Me } from '@/client/api';
import { useRoomSync } from '@/client/useRoom';
import { RoomView } from './RoomView';
import { deviceId } from '@/client/device';

/** Entry to a room: shows the join screen until this device has a seat, then the live room. */
export function RoomClient({ code }: { code: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [joined, setJoined] = useState<boolean | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await getJson<Me>('/api/identity/me');
      if (cancelled) return;
      setMe(m);
      const snap = await getJson(`/api/rooms/${code}/snapshot`);
      if (cancelled) return;
      if (!snap.ok) {
        setNotFound(snap.code === 'ROOM_NOT_FOUND');
        setJoined(false);
        return;
      }
      if (snap.me?.seatId) {
        // Opening the room on this device makes it the seat's active device (R2, R15).
        await postJson(`/api/rooms/${code}/join`, {}, { 'x-huddle-device': deviceId() });
        if (cancelled) return;
      }
      setJoined(Boolean(snap.me?.seatId));
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (notFound) return <RoomNotFound code={code} />;
  if (joined === null || !me) return <Loading />;
  if (!joined) return <JoinScreen code={code} me={me} onJoined={() => setJoined(true)} onNotFound={() => setNotFound(true)} />;
  return <LiveRoom code={code} />;
}

function LiveRoom({ code }: { code: string }) {
  const { sync, state } = useRoomSync(code);
  if (state.error === 'ROOM_NOT_FOUND') return <RoomNotFound code={code} />;
  if (!state.snapshot) return <Loading />;
  return <RoomView sync={sync} state={state} />;
}

function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center p-8 text-xl font-black text-muted" aria-busy="true">
      Loading…
    </main>
  );
}

function RoomNotFound({ code }: { code: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center" data-testid="room-not-found">
      <div className="text-6xl">🫥</div>
      <h1 className="text-3xl font-black">Room not found</h1>
      <p className="font-semibold text-muted">
        There is no live room with code <b>{code}</b>. It may have expired.
      </p>
      <Link className="btn btn-brand" href="/" data-testid="create-instead">
        Create a room
      </Link>
    </main>
  );
}

function JoinScreen({ code, me, onJoined, onNotFound }: { code: string; me: Me; onJoined: () => void; onNotFound: () => void }) {
  const [name, setName] = useState(me.identity?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (spectate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const trimmed = name.trim();
      if (!me.identity || me.identity.name !== trimmed) {
        const g = await postJson('/api/identity/guest', { name: trimmed });
        if (!g.ok) return setError(g.message ?? 'Pick a name (1–24 characters)');
      }
      const r = await postJson(`/api/rooms/${code}/join`, { spectate }, { 'x-huddle-device': deviceId() });
      if (!r.ok) {
        if (r.code === 'ROOM_NOT_FOUND') return onNotFound();
        if (r.code === 'KICKED') return setError('You were removed from this room by the admin.');
        if (r.code === 'ROOM_FULL') return setError('This room is full.');
        return setError('Could not join. Try again.');
      }
      onJoined();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6" data-testid="join-screen" data-ready="true">
      <h1 className="text-3xl font-black">Join the room</h1>
      <div className="card flex flex-col gap-3 p-5">
        <div className="text-sm font-extrabold uppercase tracking-wide text-muted">Room code</div>
        <div className="text-4xl font-black tracking-[0.3em]" data-testid="join-code-value">
          {code}
        </div>
        <label htmlFor="join-name" className="mt-2 text-sm font-extrabold uppercase tracking-wide text-muted">
          Your name
        </label>
        <input
          id="join-name"
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          data-testid="join-name"
        />
        <button className="btn btn-brand w-full text-lg" disabled={busy} onClick={() => join(false)} data-testid="join-button">
          Join game
        </button>
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => join(true)} data-testid="watch-button">
          Just watch
        </button>
        {error && (
          <p role="alert" className="font-bold text-danger" data-testid="join-error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
