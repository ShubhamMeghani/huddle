'use client';
import { useState } from 'react';
import type { RoomSync, SyncState } from '@/client/sync';
import { AVATAR_COLORS } from '@/lib/avatars';
import type { PublicSeat } from '@/engine/room';
import { deviceId } from '@/client/device';
import { postJson } from '@/client/api';

export function Avatar({ seat, size = 40 }: { seat: Pick<PublicSeat, 'avatar' | 'name'>; size?: number }) {
  const c = AVATAR_COLORS[seat.avatar.color % AVATAR_COLORS.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.5 }}
      aria-hidden="true"
      data-avatar-color={seat.avatar.color}
    >
      {seat.avatar.emoji}
    </span>
  );
}

export function ConnectionPill({ connection }: { connection: SyncState['connection'] }) {
  if (connection === 'live') return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-extrabold text-bg shadow-lg"
      data-testid="reconnecting"
    >
      {connection === 'polling' ? 'Reconnecting… (still playing)' : 'Connecting…'}
    </div>
  );
}

export function RoomView({ sync, state }: { sync: RoomSync; state: SyncState }) {
  const snap = state.snapshot!;
  const pub = snap.public;
  const me = snap.me;
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/r/${pub.code}` : `/r/${pub.code}`;
  const seated = pub.seats.filter((s) => s.status === 'seated');
  const watching = pub.seats.filter((s) => s.status === 'spectator');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-4" data-testid="room" data-version={snap.v}>
      <ConnectionPill connection={state.connection} />
      <header className="card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted">Room code</div>
          <div className="text-4xl font-black tracking-[0.25em]" data-testid="room-code">
            {pub.code}
          </div>
        </div>
        <img src={`/api/rooms/${pub.code}/qr`} alt={`QR code to join room ${pub.code}`} width={96} height={96} className="rounded-xl" data-testid="room-qr" />
      </header>
      <div className="flex gap-2">
        <input className="input text-sm" readOnly value={link} aria-label="Join link" data-testid="room-link" />
        <button className="btn btn-ghost" onClick={copy} data-testid="copy-link">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <section className="card p-4" aria-label="Players">
        <h2 className="mb-3 text-lg font-black">
          Players <span className="text-muted">({seated.length}/12)</span>
        </h2>
        <ul className="flex flex-col gap-2" data-testid="seat-list">
          {seated.map((s) => (
            <li key={s.id} className="flex items-center gap-3" data-testid="seat" data-seat-id={s.id}>
              <Avatar seat={s} />
              <span className="flex-1 truncate text-lg font-extrabold">
                {s.name}
                {s.id === me.seatId && <span className="ml-2 text-sm text-muted">(you)</span>}
              </span>
              {s.id === pub.adminSeatId && <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-black">ADMIN</span>}
              <span
                className={`h-3 w-3 rounded-full ${s.connected ? 'bg-success' : 'bg-line'}`}
                aria-label={s.connected ? 'online' : 'offline'}
              />
            </li>
          ))}
        </ul>
        {watching.length > 0 && (
          <p className="mt-3 text-sm font-bold text-muted" data-testid="spectators">
            Watching: {watching.map((s) => s.name).join(', ')}
          </p>
        )}
      </section>

      {me.deviceId && me.deviceId !== deviceId() && (
        <div className="card flex items-center justify-between gap-3 p-4" role="alert" data-testid="seat-moved">
          <span className="font-bold">Your seat is now active on another device.</span>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await postJson(`/api/rooms/${pub.code}/join`, {}, { 'x-huddle-device': deviceId() });
              void sync.fetchSnapshot();
            }}
          >
            Use here
          </button>
        </div>
      )}

      {me.role === 'spectator' && (
        <p className="card p-4 font-bold" data-testid="spectator-banner">
          You are watching. You will be seated at the next round.
        </p>
      )}

      <section className="card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted">Lobby waves</div>
          <div className="text-3xl font-black" data-testid="wave-count">
            {pub.waves}
          </div>
        </div>
        <button className="btn btn-brand text-lg" onClick={() => void sync.act('wave')} disabled={me.role !== 'player'} data-testid="wave">
          👋 Wave
        </button>
      </section>
    </main>
  );
}
