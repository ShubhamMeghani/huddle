'use client';
import { useState } from 'react';
import { GAME_META } from '@/games/meta';
import { defaultsOf } from '@/games/settings';
import type { GameConfig } from '@/engine/types';
import { Avatar, type RoomProps } from './ui';
import { SettingsForm } from './SettingsForm';
import { TeamsPanel } from './TeamsPanel';

export function PlayerList({ state }: Pick<RoomProps, 'state'>) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const seated = pub.seats.filter((s) => s.status === 'seated');
  const watching = pub.seats.filter((s) => s.status === 'spectator');
  return (
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
              {s.isBot && <span className="ml-2 text-sm text-muted">🤖</span>}
            </span>
            {s.afk && <span className="rounded-full bg-warn px-2 py-1 text-xs font-black text-bg">AFK</span>}
            {s.id === pub.adminSeatId && <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-black">ADMIN</span>}
            <span className={`h-3 w-3 rounded-full ${s.connected ? 'bg-success' : 'bg-line'}`} aria-label={s.connected ? 'online' : 'offline'} />
          </li>
        ))}
      </ul>
      {watching.length > 0 && (
        <p className="mt-3 text-sm font-bold text-muted" data-testid="spectators">
          Watching: {watching.map((s) => s.name).join(', ')}
        </p>
      )}
    </section>
  );
}

export function Lobby({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/r/${pub.code}` : `/r/${pub.code}`;
  const games = Object.values(GAME_META).filter((g) => !g.testOnly || state.testMode);
  const queue = pub.queue;

  const saveQueue = async (q: GameConfig[]) => {
    setError(null);
    const r = await sync.act('setQueue', { queue: q });
    if (!r.ok) setError(r.message ?? 'Could not save');
  };
  const start = async () => {
    setError(null);
    const r = await sync.act('start');
    if (!r.ok) setError(r.message ?? 'Could not start');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <>
      <section className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted">Invite friends</div>
          <div className="text-4xl font-black tracking-[0.25em]" data-testid="lobby-code">
            {pub.code}
          </div>
          <button className="btn btn-ghost mt-2 !min-h-11 text-sm" onClick={copy} data-testid="copy-link">
            {copied ? 'Copied!' : '🔗 Copy link'}
          </button>
        </div>
        <img src={`/api/rooms/${pub.code}/qr`} alt={`QR code to join room ${pub.code}`} width={112} height={112} className="rounded-xl" data-testid="room-qr" />
      </section>
      <input className="sr-only" readOnly value={link} aria-label="Join link" data-testid="room-link" />

      <PlayerList state={state} />

      <section className="card flex flex-col gap-3 p-4" aria-label="Game queue">
        <h2 className="text-lg font-black">Tonight&apos;s games</h2>
        {queue.length === 0 && <p className="font-semibold text-muted">{me.isAdmin ? 'Add games to the queue.' : 'Waiting for the admin to pick games…'}</p>}
        <ol className="flex flex-col gap-2" data-testid="queue">
          {queue.map((q, i) => {
            const m = GAME_META[q.gameId];
            return (
              <li key={i} className="rounded-2xl border-2 border-line p-3" data-game={q.gameId} data-testid="queue-item">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden>
                    {m?.emoji}
                  </span>
                  <span className="flex-1 font-extrabold">{m?.title}</span>
                  {me.isAdmin && (
                    <>
                      <button className="btn btn-ghost !min-h-11 !px-3 text-sm" onClick={() => setEditing(editing === i ? null : i)} data-testid={`edit-${i}`}>
                        Rules
                      </button>
                      <button
                        className="btn btn-ghost !min-h-11 !px-3 text-sm"
                        aria-label={`Remove ${m?.title}`}
                        onClick={() => void saveQueue(queue.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
                {editing === i && m && (
                  <div className="mt-3">
                    <SettingsForm
                      spec={m.settings}
                      value={q.settings}
                      testMode={state.testMode}
                      idPrefix={`set-${i}`}
                      onChange={(v) => void saveQueue(queue.map((x, j) => (j === i ? { ...x, settings: v } : x)))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {me.isAdmin && (
          <div className="flex flex-wrap gap-2" data-testid="game-picker">
            {games.map((g) => (
              <button
                key={g.id}
                className="btn btn-ghost !min-h-11 text-sm"
                data-game={g.id}
                onClick={() => void saveQueue([...queue, { gameId: g.id, settings: defaultsOf(g.settings) }])}
                data-testid={`add-${g.id}`}
              >
                {g.emoji} {g.title}
              </button>
            ))}
          </div>
        )}
      </section>

      <TeamsPanel sync={sync} state={state} />

      {me.isAdmin && (
        <button className="btn btn-brand w-full text-lg" disabled={!queue.length} onClick={start} data-testid="start">
          ▶ Start
        </button>
      )}
      {error && (
        <p role="alert" className="font-bold text-danger" data-testid="lobby-error">
          {error}
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
    </>
  );
}
