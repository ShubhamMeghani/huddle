'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SyncState } from '@/client/sync';
import { deviceId } from '@/client/device';
import { postJson } from '@/client/api';
import { Lobby } from './Lobby';
import { Playing } from './Playing';
import { BreakView, NightView } from './Scoreboard';
import { AdminMenu } from './AdminMenu';
import { Sheet, type RoomProps } from './ui';
import { HowToSheet } from './HowTo';
import { GAME_META } from '@/games/meta';

export { Avatar } from './ui';

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

function Notices({ state }: { state: SyncState }) {
  const notices = state.snapshot!.public.notices;
  const last = notices[notices.length - 1];
  const [shown, setShown] = useState<number | null>(null);
  // Notices that already existed when the room opened are history, not news.
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (seen.current === undefined) {
      seen.current = last?.id ?? null;
      return;
    }
    if (!last || last.id === seen.current) return;
    seen.current = last.id;
    setShown(last.id);
    const t = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last || shown !== last.id) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] left-1/2 z-30 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-center font-extrabold text-bg shadow-lg"
      data-testid="notice"
    >
      {last.text}
    </div>
  );
}

function ClaimApprovals({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const mine = pub.pendingClaims.filter((c) =>
    me.isAdmin ? c.seatId !== me.seatId : c.seatId === pub.adminSeatId && me.role === 'player' && me.seatId !== c.seatId,
  );
  if (!mine.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {mine.map((c) => (
        <div key={c.seatId} className="card flex flex-col gap-2 p-4" data-testid="claim-request">
          <p className="font-bold">
            {c.claimantName} says they are <b>{pub.seats.find((s) => s.id === c.seatId)?.name}</b> on a new device.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-brand flex-1" onClick={() => void sync.act('approveClaim', { seatId: c.seatId })} data-testid="approve-claim">
              Approve
            </button>
            <button className="btn btn-ghost flex-1" onClick={() => void sync.act('denyClaim', { seatId: c.seatId })}>
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoomView({ sync, state }: RoomProps) {
  const snap = state.snapshot!;
  const pub = snap.public;
  const me = snap.me;
  const [adminOpen, setAdminOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const gameId = pub.game?.id ?? pub.queue[pub.queueIndex]?.gameId;

  if (me.role === 'kicked') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center" data-testid="kicked">
        <div className="text-6xl">🚪</div>
        <h1 className="text-3xl font-black">Removed by the admin</h1>
        <Link href="/" className="btn btn-brand">
          Home
        </Link>
      </main>
    );
  }
  if (me.role === 'none') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center" data-testid="seat-gone">
        <h1 className="text-3xl font-black">Seat moved to another device</h1>
        <Link href="/" className="btn btn-brand">
          Home
        </Link>
      </main>
    );
  }

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-4"
      data-testid="room"
      data-version={snap.v}
      data-status={pub.status}
      data-game={pub.status === 'playing' ? pub.game?.id : undefined}
    >
      <ConnectionPill connection={state.connection} />
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-muted">Room</span>
          <span className="text-2xl font-black tracking-[0.2em]" data-testid="room-code">
            {pub.code}
          </span>
        </div>
        <div className="flex gap-2">
          {gameId && GAME_META[gameId] && (
            <button className="btn btn-ghost !px-3" onClick={() => setHowOpen(true)} aria-label="How to play" data-testid="howto-open">
              ?
            </button>
          )}
          {me.isAdmin && (
            <button className="btn btn-ghost !px-3" onClick={() => setAdminOpen(true)} aria-label="Admin controls" data-testid="admin-open">
              ⚙️
            </button>
          )}
        </div>
      </header>

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

      <ClaimApprovals sync={sync} state={state} />

      {me.role === 'spectator' && (
        <p className="card p-4 font-bold" data-testid="spectator-banner">
          You are watching. You will be seated at the next round.
        </p>
      )}

      {pub.status === 'lobby' && <Lobby sync={sync} state={state} />}
      {pub.status === 'playing' && <Playing sync={sync} state={state} />}
      {pub.status === 'break' && <BreakView sync={sync} state={state} />}
      {pub.status === 'summary' && <NightView sync={sync} state={state} />}

      <Notices state={state} />
      <Sheet open={adminOpen} onClose={() => setAdminOpen(false)} title="Admin controls" testId="admin-sheet">
        <AdminMenu sync={sync} state={state} close={() => setAdminOpen(false)} />
      </Sheet>
      {gameId && GAME_META[gameId] && <HowToSheet gameId={gameId} open={howOpen} onClose={() => setHowOpen(false)} />}
    </main>
  );
}
