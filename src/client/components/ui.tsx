'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { RoomSync, SyncState } from '@/client/sync';
import type { PublicSeat } from '@/engine/room';
import { AVATAR_COLORS } from '@/lib/avatars';
import { useNow } from '@/client/useRoom';

export interface RoomProps {
  sync: RoomSync;
  state: SyncState;
}

export function Avatar({ seat, size = 40 }: { seat: Pick<PublicSeat, 'avatar' | 'name'>; size?: number }) {
  const c = AVATAR_COLORS[seat.avatar.color % AVATAR_COLORS.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.5 }}
      aria-hidden="true"
      data-avatar-color={seat.avatar.color}
      data-testid="avatar"
    >
      {seat.avatar.emoji}
    </span>
  );
}

/** Bottom sheet; non-blocking for the game underneath (the game keeps running). */
export function Sheet({ open, onClose, title, children, testId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose} data-testid={testId}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        className="card max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{title}</h2>
          <button className="btn btn-ghost !px-3" onClick={onClose} aria-label="Close" data-testid="sheet-close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Seconds left on the server deadline, corrected for clock offset (R18). */
export function useSecondsLeft(sync: RoomSync, deadline: number | null, paused: { remainingMs: number } | null): number | null {
  useNow(250);
  if (paused) return Math.ceil(paused.remainingMs / 1000);
  if (deadline == null) return null;
  return sync.clock.secondsLeft(deadline);
}

export function Countdown({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const secs = useSecondsLeft(sync, pub.phase.deadline, pub.paused);
  if (secs == null) return null;
  const urgent = secs <= 5 && !pub.paused;
  return (
    <div
      className={`flex h-14 min-w-14 items-center justify-center rounded-full px-3 text-2xl font-black tabular-nums ${urgent ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent'}`}
      role="timer"
      aria-label={`${secs} seconds left`}
      data-testid="countdown"
      data-seconds={secs}
    >
      {secs}
    </div>
  );
}

export function seatName(pub: { seats: PublicSeat[] }, id: string | null | undefined): string {
  return pub.seats.find((s) => s.id === id)?.name ?? 'someone';
}
