'use client';
import { GAME_META } from '@/games/meta';
import type { PublicView } from '@/engine/room';
import { Avatar, Countdown, type RoomProps } from './ui';

type Row = { seatId: string; name: string; teamId: string | null; score: number; rank: number; placementPoints: number };

export function Standings({ rows, state, testId = 'standings' }: { rows: Row[]; state: RoomProps['state']; testId?: string }) {
  const pub = state.snapshot!.public;
  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}.`);
  return (
    <ol className="flex flex-col gap-2" data-testid={testId}>
      {rows.map((r) => {
        const seat = pub.seats.find((s) => s.id === r.seatId);
        const team = pub.teams?.find((t) => t.id === r.teamId);
        return (
          <li key={r.seatId} className="flex items-center gap-3" data-testid="standing" data-seat-id={r.seatId} data-rank={r.rank}>
            <span className="w-8 text-center text-xl font-black">{medal(r.rank)}</span>
            {seat && <Avatar seat={seat} size={32} />}
            <span className="flex-1 truncate font-extrabold">
              {r.name}
              {team && <span className="ml-2 text-sm text-muted">{team.name}</span>}
            </span>
            <span className="font-black tabular-nums" data-testid="standing-score">
              {r.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BreakView({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const last = pub.lastGame;
  const next = pub.queue[pub.queueIndex + 1];
  return (
    <section className="flex flex-col gap-4" data-testid="break">
      <div className="card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-muted">Scoreboard</div>
          <div className="text-xl font-black">
            {last ? `${GAME_META[last.gameId]?.emoji} ${GAME_META[last.gameId]?.title} results` : 'Results'}
          </div>
          <div className="font-semibold text-muted" data-testid="next-up">
            {next ? `Next: ${GAME_META[next.gameId]?.title}` : 'Night summary next'}
          </div>
        </div>
        <Countdown sync={sync} state={state} />
      </div>
      {last && (
        <div className="card p-4">
          <Standings rows={last.rows} state={state} />
        </div>
      )}
      {me.isAdmin && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-brand col-span-2" onClick={() => void sync.act('continue')} data-testid="continue">
            {next ? 'Next game ▶' : 'Finish night'}
          </button>
          <button className="btn btn-ghost" onClick={() => void sync.act('rematch')} data-testid="rematch">
            🔁 Rematch
          </button>
          <button className="btn btn-ghost" onClick={() => void sync.act('endNight')} data-testid="end-night">
            End night
          </button>
          {pub.undoAvailable && (
            <button className="btn btn-ghost col-span-2" onClick={() => void sync.act('undo')} data-testid="undo-break">
              ↩ Undo last score
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function nightTotals(pub: PublicView) {
  const totals = new Map<string, { seatId: string; name: string; points: number; wins: number }>();
  for (const g of pub.night) {
    for (const r of g.rows) {
      const t = totals.get(r.seatId) ?? { seatId: r.seatId, name: r.name, points: 0, wins: 0 };
      t.points += r.placementPoints;
      if (r.rank === 1) t.wins += 1;
      totals.set(r.seatId, t);
    }
  }
  const list = [...totals.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
  return list.map((t) => ({ ...t, rank: 1 + list.filter((x) => x.points > t.points).length }));
}

export function NightView({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const totals = nightTotals(pub);
  return (
    <section className="flex flex-col gap-4" data-testid="night-summary">
      <div className="card p-4">
        <h2 className="mb-1 text-2xl font-black">🎉 Night summary</h2>
        <p className="mb-3 font-semibold text-muted">
          {pub.night.length} game{pub.night.length === 1 ? '' : 's'} played
        </p>
        <Standings
          rows={totals.map((t) => ({ seatId: t.seatId, name: t.name, teamId: null, score: t.points, rank: t.rank, placementPoints: t.points }))}
          state={state}
          testId="night-standings"
        />
      </div>
      <div className="card p-4">
        <h3 className="mb-2 font-black">Games</h3>
        <ul className="flex flex-col gap-1">
          {pub.night.map((g) => (
            <li key={g.gameNo} className="font-semibold" data-testid="night-game">
              {GAME_META[g.gameId]?.emoji} {GAME_META[g.gameId]?.title}: winner{' '}
              <b>
                {g.rows
                  .filter((r) => r.rank === 1)
                  .map((r) => r.name)
                  .join(', ')}
              </b>
            </li>
          ))}
        </ul>
      </div>
      {me.isAdmin && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-brand" onClick={() => void sync.act('rematch')} data-testid="rematch">
            🔁 Rematch
          </button>
          <button className="btn btn-ghost" onClick={() => void sync.act('newQueue')} data-testid="new-queue">
            New games
          </button>
        </div>
      )}
    </section>
  );
}
