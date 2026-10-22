'use client';
import { useState } from 'react';
import { Avatar, type RoomProps } from './ui';

export function AdminMenu({ sync, state, close }: RoomProps & { close: () => void }) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const [error, setError] = useState<string | null>(null);
  const run = async (type: string, payload: Record<string, unknown> = {}) => {
    setError(null);
    const r = await sync.act(type, payload);
    if (!r.ok) setError(r.message ?? r.code ?? 'Failed');
    else close();
  };
  const playing = pub.status === 'playing';
  const others = pub.seats.filter((s) => s.id !== me.seatId && (s.status === 'seated' || s.status === 'spectator'));
  return (
    <div className="flex flex-col gap-4">
      {playing && (
        <div className="grid grid-cols-2 gap-2">
          {pub.paused ? (
            <button className="btn btn-brand" onClick={() => run('resume')} data-testid="admin-resume">
              ▶ Resume
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => run('pause')} data-testid="admin-pause">
              ⏸ Pause
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => run('skip')} disabled={Boolean(pub.paused)} data-testid="admin-skip">
            ⏭ Skip turn
          </button>
          <button className="btn btn-ghost" onClick={() => run('undo')} disabled={!pub.undoAvailable} data-testid="admin-undo">
            ↩ Undo score
          </button>
          <button className="btn btn-danger" onClick={() => run('endGame')} data-testid="admin-end-game">
            End game
          </button>
        </div>
      )}
      {pub.status !== 'lobby' && (
        <button className="btn btn-ghost" onClick={() => run('endNight')} data-testid="admin-end-night">
          End night
        </button>
      )}
      <section>
        <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-muted">Players</h3>
        <ul className="flex flex-col gap-2">
          {others.map((s) => (
            <li key={s.id} className="flex items-center gap-2" data-testid="admin-player" data-seat-id={s.id}>
              <Avatar seat={s} size={32} />
              <span className="flex-1 truncate font-bold">{s.name}</span>
              {!s.isBot && s.status === 'seated' && (
                <button className="btn btn-ghost !min-h-11 !px-3 text-sm" onClick={() => run('transferAdmin', { seatId: s.id })} data-testid="make-admin">
                  👑
                </button>
              )}
              <button className="btn btn-ghost !min-h-11 !px-3 text-sm text-danger" onClick={() => run('kick', { seatId: s.id })} aria-label={`Remove ${s.name}`} data-testid="kick">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
