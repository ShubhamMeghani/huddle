'use client';
import { useEffect, useRef } from 'react';
import { GAME_META } from '@/games/meta';
import { GAME_COMPONENTS } from '@/client/games';
import { Countdown, seatName, type RoomProps } from './ui';
import { LeaderboardButton } from './Leaderboard';

/** Gentle vibration when it becomes your turn (R40); silently does nothing where unsupported (iOS). */
function useTurnVibration(mustAct: boolean) {
  const prev = useRef(mustAct);
  useEffect(() => {
    if (mustAct && !prev.current) {
      try {
        if (localStorage.getItem('huddle-vibrate') !== 'off' && typeof navigator.vibrate === 'function') navigator.vibrate(150);
      } catch {}
    }
    prev.current = mustAct;
  }, [mustAct]);
}

export function TurnStatus({ state }: Pick<RoomProps, 'state'>) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const mustAct = Boolean(me.game?.mustAct);
  let text: string;
  if (pub.paused) text = 'Paused';
  else if (mustAct) text = 'Your turn';
  else if (pub.phase.turnSeatId && pub.phase.turnSeatId !== me.seatId) text = `Waiting for ${seatName(pub, pub.phase.turnSeatId)}`;
  else if (me.role !== 'player') text = 'Watching';
  else text = 'Waiting for others';
  return (
    <div className={`text-lg font-black ${mustAct ? 'text-accent' : 'text-muted'}`} role="status" data-testid="turn-status" data-must-act={mustAct}>
      {text}
    </div>
  );
}

export function Playing({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const game = pub.game!;
  const meta = GAME_META[game.id];
  const mySeat = pub.seats.find((s) => s.id === me.seatId);
  useTurnVibration(Boolean(me.game?.mustAct));
  const Game = GAME_COMPONENTS[game.id];

  return (
    <section className="flex flex-1 flex-col gap-4" data-game={game.id} data-testid="playing">
      <div className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-sm font-black uppercase tracking-wide text-accent">
            {meta?.emoji} {meta?.title}
          </div>
          <TurnStatus state={state} />
        </div>
        <Countdown sync={sync} state={state} />
      </div>

      {mySeat?.afk && (
        <div className="card flex items-center justify-between gap-3 p-4" role="alert" data-testid="afk-banner">
          <span className="font-bold">You were marked AFK. Your turns are skipped.</span>
          <button className="btn btn-primary" onClick={() => void sync.act('imBack')} data-testid="im-back">
            I&apos;m back
          </button>
        </div>
      )}

      {pub.paused && (
        <div className="card p-6 text-center" role="status" data-testid="paused">
          <div className="text-4xl">⏸️</div>
          <p className="text-xl font-black">Paused</p>
          <p className="font-semibold text-muted">{me.isAdmin ? 'Resume from the admin controls.' : 'Waiting for the admin to resume.'}</p>
        </div>
      )}

      {Game ? <Game sync={sync} state={state} /> : <p className="font-bold">Loading game…</p>}
      <div className="h-20" aria-hidden />
      <LeaderboardButton sync={sync} state={state} />
    </section>
  );
}
