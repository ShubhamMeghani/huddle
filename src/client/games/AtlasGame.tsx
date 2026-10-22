'use client';
import { useState } from 'react';
import { Avatar, seatName, type RoomProps } from '@/client/components/ui';
import { ATLAS_ATTRIBUTION } from '@/games/atlas/meta';

interface AtlasView {
  variant: 'any' | 'india' | 'countries';
  order: string[];
  lives: Record<string, number>;
  out: string[];
  letter: string;
  chain: { seatId: string; name: string; custom: boolean }[];
  count: number;
  vote: { name: string; proposer: string; votedIds: string[] } | null;
  winner: string | null;
}

const VARIANT = { any: 'Anywhere', india: 'India only', countries: 'Countries only' };

export function AtlasGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as AtlasView;
  const kind = pub.phase.kind;
  const myTurn = kind === 'turn' && pub.phase.turnSeatId === me.seatId;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canVote = Boolean(me.game?.mustAct) && kind === 'vote';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    const r = await sync.act('submit', { text: text.trim() });
    if (r.ok) setText('');
    else setError(r.message ?? 'Not accepted');
  };

  return (
    <div className="flex flex-col gap-3" data-testid="atlas">
      <div className="card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-muted">{VARIANT[v.variant]} · next place starts with</div>
          <div className="text-6xl font-black text-accent" data-testid="atlas-letter">
            {v.letter.toUpperCase()}
          </div>
        </div>
        <div className="text-right text-sm font-bold text-muted">{v.count} places so far</div>
      </div>

      {myTurn && (
        <form className="card flex flex-col gap-2 p-4" onSubmit={submit}>
          <label htmlFor="place" className="font-black">
            Your place
          </label>
          <div className="flex gap-2">
            <input
              id="place"
              className="input"
              value={text}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              data-testid="atlas-input"
            />
            <button className="btn btn-primary" type="submit" data-testid="atlas-send">
              Go
            </button>
          </div>
          {error && (
            <p role="alert" className="font-bold text-danger" data-testid="atlas-error">
              {error}
            </p>
          )}
        </form>
      )}

      {kind === 'vote' && v.vote && (
        <div className="card flex flex-col gap-2 p-4 text-center" data-testid="atlas-vote">
          <p className="text-lg font-black">
            Is “{v.vote.name}” a real place? <span className="text-muted">({seatName(pub, v.vote.proposer)})</span>
          </p>
          {canVote ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-primary" onClick={() => void sync.act('vote', { accept: true })} data-testid="atlas-accept">
                ✓ Accept
              </button>
              <button className="btn btn-ghost" onClick={() => void sync.act('vote', { accept: false })} data-testid="atlas-reject">
                ✗ Reject
              </button>
            </div>
          ) : (
            <p className="font-bold text-muted">Waiting for votes…</p>
          )}
        </div>
      )}

      <section className="card p-4" aria-label="Players and lives">
        <ul className="flex flex-col gap-2" data-testid="atlas-players">
          {v.order.map((id) => {
            const seat = pub.seats.find((s) => s.id === id);
            const out = v.out.includes(id);
            return (
              <li key={id} className={`flex items-center gap-2 ${out ? 'opacity-40 line-through' : ''} ${pub.phase.turnSeatId === id ? 'font-black' : 'font-bold'}`} data-testid="atlas-player" data-out={out}>
                {seat && <Avatar seat={seat} size={28} />}
                <span className="flex-1 truncate">{seat?.name}</span>
                <span aria-label={`${v.lives[id] ?? 0} lives`}>{'❤️'.repeat(Math.max(0, v.lives[id] ?? 0))}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-4" aria-label="Places named">
        <ol className="flex flex-wrap gap-2" data-testid="atlas-chain">
          {v.chain.map((c, i) => (
            <li key={i} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold" data-testid="atlas-place">
              {c.name}
              {c.custom ? ' *' : ''}
            </li>
          ))}
        </ol>
      </section>
      <p className="text-center text-xs font-semibold text-muted" data-testid="atlas-attribution">
        {ATLAS_ATTRIBUTION}
      </p>
    </div>
  );
}
