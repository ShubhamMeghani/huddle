'use client';
import { seatName, type RoomProps } from '@/client/components/ui';

interface CharadesView {
  round: number;
  rounds: number;
  teamId: string | null;
  actorId: string | null;
  passesLeft: number;
  steal: boolean;
  last: { teamId: string; title: string; result: 'guessed' | 'timeout' | 'stolen'; points: number; stolenBy: string | null } | null;
}

const ERA = { classic: 'Classic', golden: '1990–2009', modern: '2010 onwards' } as const;

export function CharadesGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as CharadesView;
  const kind = pub.phase.kind;
  const mine = (me.game ?? {}) as { actor?: boolean; movie?: { title: string; year: number; industry: string; era: keyof typeof ERA; words: number } };
  const team = pub.teams?.find((t) => t.id === v.teamId);
  const teamName = (id: string | null) => pub.teams?.find((t) => t.id === id)?.name ?? '';

  return (
    <div className="flex flex-col gap-3" data-testid="charades">
      <p className="text-sm font-black uppercase tracking-wide text-muted">
        Round {v.round}/{v.rounds} · {team?.name} is up
      </p>

      {mine.actor && mine.movie && (kind === 'act' || kind === 'steal') && (
        <div className="card flex flex-col gap-3 p-5 text-center" data-testid="charades-actor">
          <div className="text-xs font-black uppercase tracking-wide text-muted">Act this out. No talking!</div>
          <div className="text-3xl font-black text-accent" data-testid="charades-title">
            {mine.movie.title}
          </div>
          <div className="font-bold text-muted">
            {mine.movie.industry === 'bollywood' ? 'Bollywood' : 'Hollywood'} · {mine.movie.year} · {ERA[mine.movie.era]} · {mine.movie.words} word
            {mine.movie.words === 1 ? '' : 's'}
          </div>
          {kind === 'act' && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-primary h-16 text-xl" onClick={() => void sync.act('guessed')} data-testid="charades-guessed">
                ✓ Guessed
              </button>
              <button className="btn btn-ghost h-16" disabled={v.passesLeft <= 0} onClick={() => void sync.act('pass')} data-testid="charades-pass">
                Pass ({v.passesLeft})
              </button>
            </div>
          )}
          {kind === 'steal' && (
            <div className="flex flex-col gap-2" data-testid="charades-steal">
              <p className="font-black">Time! Did another team steal it?</p>
              {(pub.teams ?? [])
                .filter((t) => t.id !== v.teamId)
                .map((t) => (
                  <button key={t.id} className="btn btn-primary" onClick={() => void sync.act('steal', { teamId: t.id })} data-testid="steal-team" data-team-id={t.id}>
                    {t.name} got it
                  </button>
                ))}
              <button className="btn btn-ghost" onClick={() => void sync.act('steal', { teamId: null })} data-testid="steal-none">
                Nobody
              </button>
            </div>
          )}
        </div>
      )}

      {!mine.actor && (kind === 'act' || kind === 'steal') && (
        <div className="card p-5 text-center" data-testid="charades-watch">
          <div className="text-5xl">🎭</div>
          <p className="text-xl font-black">
            {seatName(pub, v.actorId)} is acting for {team?.name}
          </p>
          <p className="font-bold text-muted">{kind === 'steal' ? 'Steal time! Shout your guess!' : me.seatId && team?.seatIds.includes(me.seatId) ? 'Guess out loud!' : 'Watch the other team…'}</p>
        </div>
      )}

      {kind === 'reveal' && v.last && (
        <div className="card p-5 text-center" data-testid="charades-reveal" data-result={v.last.result}>
          <p className="text-sm font-black uppercase tracking-wide text-muted">The movie was</p>
          <p className="text-3xl font-black text-accent" data-testid="charades-revealed-title">
            {v.last.title}
          </p>
          <p className="font-bold">
            {v.last.result === 'guessed'
              ? `${teamName(v.last.teamId)} +${v.last.points}`
              : v.last.result === 'stolen'
                ? `Stolen by ${teamName(v.last.stolenBy)} +${v.last.points}`
                : 'Time ran out'}
          </p>
        </div>
      )}

      <section className="card p-4" aria-label="Team scores">
        <ul className="flex flex-col gap-1" data-testid="charades-scores">
          {(pub.teams ?? []).map((t) => (
            <li key={t.id} className={`flex justify-between font-black ${t.id === v.teamId ? 'text-accent' : ''}`} data-testid="team-score" data-team-id={t.id}>
              <span>{t.name}</span>
              <span data-testid="team-score-value">{pub.teamScores[t.id] ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
