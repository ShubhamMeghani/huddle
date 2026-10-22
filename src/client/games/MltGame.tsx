'use client';
import { useEffect, useState } from 'react';
import { useNow } from '@/client/useRoom';
import { Avatar, type RoomProps } from '@/client/components/ui';

interface MltView {
  round: number;
  rounds: number;
  prompt: string;
  votedIds: string[];
  selfVote: boolean;
  totals: { seatId: string; votes: number }[] | null;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduce;
}

export function MltGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as MltView;
  const kind = pub.phase.kind;
  const voted = Boolean((me.game as { voted?: boolean } | null)?.voted);
  const [choice, setChoice] = useState<{ round: number; seatId: string } | null>(null); // remembered on this phone only
  const reduce = useReducedMotion();
  useNow(200);
  const players = pub.seats.filter((s) => s.status === 'seated');
  // Dramatic reveal: totals appear one by one, fewest votes first (~5 s); all at once with reduced motion.
  const total = v.totals?.length ?? 0;
  const step = Math.max(300, Math.floor(5000 / Math.max(1, total)));
  const elapsed = sync.clock.now() - pub.phase.startedAt;
  const shown = !v.totals ? 0 : reduce ? total : Math.min(total, Math.floor(elapsed / step) + 1);

  const max = Math.max(0, ...(v.totals ?? []).map((t) => t.votes));

  return (
    <div className="flex flex-col gap-3" data-testid="mlt">
      <p className="text-sm font-black uppercase tracking-wide text-muted">
        Prompt {v.round}/{v.rounds}
      </p>
      <div className="card p-5 text-center">
        <p className="text-2xl font-black leading-snug" data-testid="mlt-prompt">
          {v.prompt}
        </p>
      </div>

      {kind === 'vote' && (
        <div className="card flex flex-col gap-2 p-4" data-testid="mlt-vote">
          {players
            .filter((s) => v.selfVote || s.id !== me.seatId)
            .map((s) => {
              const picked = choice?.round === v.round && choice.seatId === s.id;
              return (
                <button
                  key={s.id}
                  className={`btn justify-start ${picked ? 'btn-primary' : 'btn-ghost'}`}
                  disabled={voted || me.role !== 'player'}
                  onClick={async () => {
                    setChoice({ round: v.round, seatId: s.id });
                    const r = await sync.act('vote', { seatId: s.id });
                    if (!r.ok) setChoice(null);
                  }}
                  data-testid="mlt-vote-for"
                  data-seat-id={s.id}
                >
                  <Avatar seat={s} size={28} /> {s.name}
                </button>
              );
            })}
          <p className="text-center text-sm font-bold text-muted" data-testid="mlt-voted">
            {voted ? '🤫 Vote locked in · ' : ''}
            {v.votedIds.length}/{players.length} voted
          </p>
        </div>
      )}

      {kind === 'reveal' && v.totals && (
        <ol className="card flex flex-col gap-2 p-4" data-testid="mlt-reveal" data-shown={shown}>
          {v.totals.slice(0, shown).map((t) => {
            const seat = pub.seats.find((s) => s.id === t.seatId);
            const winner = t.votes === max && max > 0;
            return (
              <li
                key={t.seatId}
                className={`flex items-center gap-3 rounded-2xl p-2 ${winner ? 'bg-accent text-on-accent' : ''}`}
                style={reduce ? undefined : { animation: 'mlt-pop 400ms ease-out' }}
                data-testid="mlt-total"
                data-votes={t.votes}
                data-winner={winner}
              >
                {seat && <Avatar seat={seat} size={36} />}
                <span className="flex-1 text-lg font-black">{seat?.name}</span>
                <span className="text-2xl font-black tabular-nums">{t.votes}</span>
                {winner && <span aria-label="most votes">👑</span>}
              </li>
            );
          })}
        </ol>
      )}
      <style>{`@keyframes mlt-pop { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
    </div>
  );
}
