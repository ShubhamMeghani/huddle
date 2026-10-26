'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJson } from '@/client/api';
import { useRoomSync } from '@/client/useRoom';
import { GAME_META } from '@/games/meta';
import { IntroCard } from './IntroCard';
import { GAME_COMPONENTS } from '@/client/games';
import { LiveLeaderboard } from './Leaderboard';
import { Countdown, type RoomProps } from './ui';
import { Standings, nightTotals } from './Scoreboard';
import { ConnectionPill, TopStack } from './RoomView';

export function ScreenJoin() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4">
      <h1 className="text-4xl font-black">Big screen</h1>
      <p className="font-semibold text-muted">Show the game on a laptop or TV. Phones stay the controllers.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[a-zA-Z]{4}$/.test(code)) router.push(`/screen/${code.toUpperCase()}`);
        }}
      >
        <input className="input uppercase tracking-[0.3em]" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, ''))} aria-label="Room code" data-testid="screen-code" />
        <button className="btn btn-brand" type="submit" data-testid="screen-go">
          Show
        </button>
      </form>
    </main>
  );
}

export function ScreenRoom({ code }: { code: string }) {
  const [ready, setReady] = useState<'pending' | 'ok' | 'full' | 'missing'>('pending');
  useEffect(() => {
    postJson(`/api/rooms/${code}/screen`, {}).then((r) => setReady(r.ok ? 'ok' : r.code === 'ROOM_FULL' ? 'full' : 'missing'));
  }, [code]);
  if (ready === 'pending') return <main className="p-10 text-center text-2xl font-black text-muted">Connecting…</main>;
  if (ready !== 'ok')
    return (
      <main className="p-10 text-center text-2xl font-black" data-testid="screen-error">
        {ready === 'full' ? 'This room already has two big screens.' : 'Room not found.'}
      </main>
    );
  return <ScreenLive code={code} />;
}

function ScreenLive({ code }: { code: string }) {
  const { sync, state } = useRoomSync(code, true);
  if (!state.snapshot) return <main className="p-10 text-center text-2xl font-black text-muted">Loading…</main>;
  return <ScreenBody sync={sync} state={state} />;
}

function ScreenBody({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const origin = typeof window !== 'undefined' ? window.location.origin.replace(/^https?:\/\//, '') : '';
  const Game = pub.game ? GAME_COMPONENTS[pub.game.id] : null;
  const meta = pub.game ? GAME_META[pub.game.id] : null;
  return (
    <main className="flex min-h-[100dvh] w-full flex-col gap-6 p-8" data-testid="screen" data-version={state.snapshot!.v} data-game={pub.game?.id}>
      <TopStack>
        <ConnectionPill connection={state.connection} />
      </TopStack>
      <header className="flex items-center justify-between gap-6">
        <div className="text-5xl font-black">
          Huddle<span className="text-brand">.</span> {meta && <span className="text-accent-ink">{meta.emoji} {meta.title}</span>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-bold text-muted">Join at {origin}/r/</div>
            <div className="text-6xl font-black tracking-[0.2em]" data-testid="screen-code-value">
              {pub.code}
            </div>
          </div>
          {pub.status !== 'lobby' && <img src={`/api/rooms/${pub.code}/qr`} alt="Join QR" width={110} height={110} className="rounded-xl" />}
        </div>
      </header>

      {pub.status === 'lobby' && (
        <section className="flex flex-1 items-center justify-center gap-16" data-testid="screen-lobby">
          <img src={`/api/rooms/${pub.code}/qr`} alt={`QR code to join room ${pub.code}`} width={360} height={360} className="rounded-3xl" data-testid="screen-qr" />
          <div className="min-w-[320px]">
            <h2 className="mb-4 text-4xl font-black">Players</h2>
            <LiveLeaderboard state={state} big />
          </div>
        </section>
      )}

      {pub.status === 'playing' && Game && (
        <section className="grid flex-1 grid-cols-[2fr_1fr] gap-8" data-game={pub.game!.id}>
          <div className="text-xl">
            {pub.game!.intro ? <IntroCard sync={sync} state={state} /> : <Game sync={sync} state={state} />}
          </div>
          <aside className="card flex flex-col gap-4 p-6" data-testid="screen-sidebar">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black">Leaderboard</h2>
              <Countdown sync={sync} state={state} />
            </div>
            <LiveLeaderboard state={state} big />
          </aside>
        </section>
      )}

      {(pub.status === 'break' || pub.status === 'summary') && (
        <section className="mx-auto w-full max-w-3xl text-2xl" data-testid="screen-scoreboard">
          <h2 className="mb-4 text-4xl font-black">{pub.status === 'break' ? 'Scoreboard' : 'Night summary'}</h2>
          <div className="card p-6">
            {pub.status === 'break' && pub.lastGame ? (
              <Standings rows={pub.lastGame.rows} state={state} />
            ) : (
              <Standings
                rows={nightTotals(pub).map((t) => ({ seatId: t.seatId, name: t.name, teamId: null, score: t.points, rank: t.rank, placementPoints: t.points }))}
                state={state}
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}
