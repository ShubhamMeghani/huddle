'use client';
import type { RoomProps } from '@/client/components/ui';

export function PingGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const view = pub.game!.view as { round: number; rounds: number };
  const mustAct = Boolean(me.game?.mustAct) && !pub.paused;
  return (
    <div className="card flex flex-col items-center gap-4 p-6">
      <p className="font-bold text-muted">
        Round {view.round} of {view.rounds}
      </p>
      <button className="btn btn-primary h-24 w-full text-3xl" disabled={!mustAct} onClick={() => void sync.act('ping')} data-testid="ping">
        🏓 Ping
      </button>
      <ul className="w-full">
        {pub.seats
          .filter((s) => s.status === 'seated')
          .map((s) => (
            <li key={s.id} className="flex justify-between font-bold" data-testid="score-row" data-seat-id={s.id}>
              <span>{s.name}</span>
              <span data-testid="score">{s.score}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
