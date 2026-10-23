'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJson, postJson, type Me } from '@/client/api';
import { GAME_META } from '@/games/meta';
import { DEMO_GAMES } from '@/games/demo';
import type { GameId } from '@/engine/types';
import type { RoomProps } from './ui';

/** /demo: one tap to a room with four bots, no sign-in (R43). */
export function DemoStart() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson<Me>('/api/identity/me').then((m) => {
      setMe(m);
      setName(m.identity?.name ?? 'Guest');
    });
  }, []);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!me?.identity || me.identity.name !== name.trim()) {
        const g = await postJson('/api/identity/guest', { name: name.trim() || 'Guest' });
        if (!g.ok) return setError('Pick a name (1–24 characters)');
      }
      const r = await postJson('/api/demo', {});
      if (!r.ok) return setError('Could not start the demo. Try again.');
      router.push(`/r/${r.code}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-6" data-testid="demo-start" data-ready={me ? 'true' : 'false'}>
      <h1 className="text-4xl font-black">Try Huddle solo</h1>
      <p className="text-lg font-semibold text-muted">
        You get a room with four friendly bots: Priya, Rahul, Meera and Kabir. Pick any game and play a short round. No sign-in needed.
      </p>
      <label htmlFor="demo-name" className="text-sm font-extrabold uppercase tracking-wide text-muted">
        Your name
      </label>
      <input id="demo-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-testid="demo-name" />
      <button className="btn btn-brand w-full text-lg" disabled={busy || !me} onClick={start} data-testid="demo-go">
        🤖 Start the demo
      </button>
      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
    </main>
  );
}

/** In demo rooms the admin gets a one-tap game picker with short preset rules. */
export function DemoPicker({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!pub.isDemo || !me.isAdmin) return null;
  // A start the server rejects must say so: a silent no-op looks like a broken button.
  const start = async (id: GameId) => {
    setStarting(true);
    setError(null);
    const r = await sync.act('demoStart', { gameId: id });
    setStarting(false);
    if (!r.ok) setError(r.code === 'RATE_LIMITED' ? 'Too many taps at once. Wait a second and try again.' : 'That game could not start. Try again.');
  };
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Demo game picker" data-testid="demo-picker">
      <h2 className="text-lg font-black">Pick a game to play with the bots</h2>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_GAMES.map((id) => (
          <button key={id} className="btn btn-ghost !min-h-14 justify-start" data-game={id} onClick={() => void start(id)} disabled={starting} data-testid={`demo-${id}`}>
            <span className="text-2xl" aria-hidden>
              {GAME_META[id].emoji}
            </span>
            <span className="text-left text-sm font-black">{GAME_META[id].title}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="font-bold text-danger" data-testid="demo-error">
          {error}
        </p>
      )}
    </section>
  );
}
