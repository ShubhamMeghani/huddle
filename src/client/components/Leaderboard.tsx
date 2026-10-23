'use client';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Countdown, type RoomProps } from './ui';

/** Live scores and teams (R38, R54). Used by the phone overlay and the big screen sidebar. */
export function LiveLeaderboard({ state, big = false }: Pick<RoomProps, 'state'> & { big?: boolean }) {
  const pub = state.snapshot!.public;
  const players = pub.seats.filter((s) => s.status === 'seated').sort((a, b) => b.score - a.score);
  const teams = pub.teams?.filter((t) => t.seatIds.some((id) => players.some((p) => p.id === id)));
  const teamMode = Boolean(teams?.length) && Object.keys(pub.teamScores).length > 0;
  return (
    <div className="flex flex-col gap-3" data-testid="live-leaderboard">
      {teamMode && (
        <ul className="flex flex-col gap-1" data-testid="lb-teams">
          {[...teams!]
            .sort((a, b) => (pub.teamScores[b.id] ?? 0) - (pub.teamScores[a.id] ?? 0))
            .map((t) => (
              <li key={t.id} className={`flex justify-between rounded-2xl bg-accent-soft px-3 py-2 font-black ${big ? 'text-2xl' : ''}`} data-testid="lb-team">
                <span>{t.name}</span>
                <span className="tabular-nums">{pub.teamScores[t.id] ?? 0}</span>
              </li>
            ))}
        </ul>
      )}
      <ol className="flex flex-col gap-2" data-testid="lb-players">
        {players.map((s, i) => {
          const team = pub.teams?.find((t) => t.seatIds.includes(s.id));
          return (
            <li key={s.id} className={`flex items-center gap-3 ${big ? 'text-2xl' : ''}`} data-testid="lb-row" data-seat-id={s.id}>
              <span className="w-6 text-right font-black text-muted">{i + 1}</span>
              <Avatar seat={s} size={big ? 48 : 32} />
              <span className="flex-1 truncate font-extrabold">
                {s.name}
                {team && <span className="ml-2 text-sm font-bold text-muted">{team.name}</span>}
                {s.afk && <span className="ml-2 text-xs font-black text-warn">AFK</span>}
              </span>
              <span key={s.score} className="bump font-black tabular-nums" data-testid="lb-score">
                {teamMode ? '' : s.score}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Floating 🏆 button + overlay. Non-blocking: the game keeps running underneath and keeps its state. */
export function LeaderboardButton({ sync, state }: RoomProps) {
  const [open, setOpen] = useState(false);
  const mustAct = Boolean(state.snapshot!.me.game?.mustAct);
  const prev = useRef(mustAct);
  useEffect(() => {
    // Close automatically when it becomes this player's turn to act.
    if (mustAct && !prev.current) setOpen(false);
    prev.current = mustAct;
  }, [mustAct]);
  return (
    <>
      <button
        className="btn btn-brand fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-[calc(env(safe-area-inset-right)+16px)] z-30 !h-14 !w-14 !rounded-full !p-0 text-2xl shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Leaderboard"
        data-testid="leaderboard-open"
      >
        🏆
      </button>
      {open && (
        <div
          className="card fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-h-[70dvh] max-w-md overflow-y-auto p-4 shadow-2xl"
          role="dialog"
          aria-label="Leaderboard"
          data-testid="leaderboard"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-black">Leaderboard</h2>
            <div className="flex items-center gap-2">
              <Countdown sync={sync} state={state} />
              <button className="btn btn-ghost !px-3" onClick={() => setOpen(false)} aria-label="Close leaderboard" data-testid="leaderboard-close">
                ✕
              </button>
            </div>
          </div>
          <LiveLeaderboard state={state} />
        </div>
      )}
    </>
  );
}
