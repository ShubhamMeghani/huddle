'use client';
import { useEffect, useRef, useState } from 'react';
import { Avatar, seatName, type RoomProps } from '@/client/components/ui';
import { NPAT_LABELS } from '@/games/npat/meta';

type Cat = 'name' | 'place' | 'animal' | 'thing' | 'movie';
interface Item {
  key: string;
  cat: Cat;
  text: string;
  seatIds: string[];
  check: 'ok' | 'bad' | 'vote';
  valid: boolean | null;
  rejects: number;
}
interface NpatView {
  round: number;
  rounds: number;
  letter: string;
  cats: Cat[];
  doneIds: string[];
  items: Item[];
  voteDoneIds: string[];
  points: Record<string, number> | null;
}

export function NpatGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as NpatView;
  const kind = pub.phase.kind;
  const priv = (me.game ?? {}) as { mine?: Partial<Record<Cat, string>>; done?: boolean; myRejects?: string[] };
  const players = pub.seats.filter((s) => s.status === 'seated');
  const L = v.letter.toUpperCase();

  return (
    <div className="flex flex-col gap-3" data-testid="npat">
      <div className="card flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-muted">
            Round {v.round}/{v.rounds} · everything starts with
          </div>
          <div className="text-6xl font-black text-accent-ink" data-testid="npat-letter">
            {L}
          </div>
        </div>
        {kind === 'write' && (
          <div className="shrink-0 text-right text-sm font-bold text-muted" data-testid="npat-done-count">
            {v.doneIds.length}/{players.length} done
          </div>
        )}
      </div>
      {kind === 'write' &&
        (me.role === 'player' ? (
          <WriteForm key={`${pub.game!.gameNo}-${v.round}`} sync={sync} state={state} cats={v.cats} letter={L} mine={priv.mine ?? {}} done={Boolean(priv.done)} />
        ) : (
          <p className="card p-5 text-center text-lg font-black" data-testid="npat-writing">
            ✍️ Everyone is writing a {v.cats.map((c) => NPAT_LABELS[c]).join(', ')}…
          </p>
        ))}
      {(kind === 'vote' || kind === 'results') && <Review sync={sync} state={state} v={v} myRejects={priv.myRejects ?? []} />}
    </div>
  );
}

function WriteForm({ sync, state, cats, letter, mine, done }: RoomProps & { cats: Cat[]; letter: string; mine: Partial<Record<Cat, string>>; done: boolean }) {
  const me = state.snapshot!.me;
  // Typed text is local; the server copy (restored after a reload) seeds it once per round.
  const [draft, setDraft] = useState<Partial<Record<Cat, string>>>(mine);
  const saved = useRef(JSON.stringify(mine));
  const canWrite = me.role === 'player' && !done && !state.snapshot!.public.paused;

  // Saves a second after typing stops, so a timer that ends mid-word still counts what was written.
  useEffect(() => {
    if (!canWrite || JSON.stringify(draft) === saved.current) return;
    const t = setTimeout(() => {
      saved.current = JSON.stringify(draft);
      void sync.act('fill', { answers: draft });
    }, 1000);
    return () => clearTimeout(t);
  }, [draft, canWrite, sync]);

  return (
    <form
      className="card flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        saved.current = JSON.stringify(draft);
        void sync.act('done', { answers: draft });
      }}
      data-testid="npat-form"
    >
      {cats.map((c) => (
        <label key={c} htmlFor={`npat-${c}`} className="flex flex-col gap-1 font-black">
          {NPAT_LABELS[c]}
          <input
            id={`npat-${c}`}
            className="input"
            value={draft[c] ?? ''}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="words"
            placeholder={`${letter}…`}
            disabled={!canWrite}
            onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.value }))}
            data-testid={`npat-input-${c}`}
          />
        </label>
      ))}
      {me.role === 'player' && (
        <button className="btn btn-primary w-full text-lg" type="submit" disabled={!canWrite} data-testid="npat-done">
          {done ? '🔒 Locked in' : 'Done'}
        </button>
      )}
    </form>
  );
}

function Review({ sync, state, v, myRejects }: RoomProps & { v: NpatView; myRejects: string[] }) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const voting = pub.phase.kind === 'vote';
  const iAmDone = Boolean(me.seatId && v.voteDoneIds.includes(me.seatId));
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const players = pub.seats.filter((s) => s.status === 'seated');
  return (
    <>
      {voting && (
        <p className="text-center font-bold text-muted" data-testid="npat-vote-help">
          Tap 👎 on any answer that doesn’t count. It stays unless most players reject it.
        </p>
      )}
      {v.cats.map((c) => {
        const items = v.items.filter((i) => i.cat === c);
        return (
          <section key={c} className="card flex flex-col gap-2 p-4" aria-label={NPAT_LABELS[c]}>
            <h3 className="text-sm font-black uppercase tracking-wide text-muted">{NPAT_LABELS[c]}</h3>
            {items.length === 0 && <p className="text-sm font-semibold text-muted">Nobody wrote one.</p>}
            {items.map((it) => {
              const mine = Boolean(me.seatId && it.seatIds.includes(me.seatId));
              const rejected = pending[it.key] ?? myRejects.includes(it.key);
              const canVote = voting && it.check === 'vote' && !mine && me.role === 'player' && !iAmDone;
              return (
                <div key={it.key} className="flex items-center gap-2" data-testid="npat-item" data-key={it.key} data-check={it.check} data-valid={String(it.valid)}>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-lg font-black ${it.valid === false ? 'line-through text-muted' : ''}`}>{it.text}</div>
                    <div className="flex flex-wrap items-center gap-1 text-sm font-bold text-muted">
                      {it.seatIds.map((id) => {
                        const seat = pub.seats.find((s) => s.id === id);
                        return seat ? <Avatar key={id} seat={seat} size={20} /> : null;
                      })}
                      <span className="truncate">{it.seatIds.map((id) => seatName(pub, id)).join(', ')}</span>
                    </div>
                  </div>
                  {it.check === 'ok' && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-xs font-black">✓ on the map</span>}
                  {it.check === 'bad' && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-xs font-black">✗ wrong letter</span>}
                  {it.check === 'vote' && voting && (
                    <button
                      className={`btn shrink-0 !px-3 ${rejected ? 'btn-primary' : 'btn-ghost'}`}
                      aria-pressed={rejected}
                      aria-label={`Reject ${it.text}`}
                      disabled={!canVote}
                      onClick={async () => {
                        setPending((p) => ({ ...p, [it.key]: !rejected }));
                        await sync.act('reject', { key: it.key, on: !rejected });
                        setPending((p) => {
                          const { [it.key]: _, ...rest } = p;
                          return rest;
                        });
                      }}
                      data-testid="npat-reject"
                    >
                      👎 {it.rejects}
                    </button>
                  )}
                  {v.points && (
                    <span className="w-12 shrink-0 text-right text-lg font-black tabular-nums" data-testid="npat-item-points">
                      {it.valid ? (it.seatIds.length === 1 ? '+10' : '+5') : '0'}
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {voting && me.role === 'player' && (
        <button className="btn btn-primary w-full text-lg" disabled={iAmDone} onClick={() => void sync.act('voteDone')} data-testid="npat-vote-done">
          {iAmDone ? `Waiting… ${v.voteDoneIds.length}/${players.length}` : 'Looks good'}
        </button>
      )}
      {v.points && (
        <ol className="card flex flex-col gap-2 p-4" data-testid="npat-results">
          {players
            .map((s) => ({ s, p: v.points![s.id] ?? 0 }))
            .sort((a, b) => b.p - a.p)
            .map(({ s, p }) => (
              <li key={s.id} className="flex items-center gap-3" data-testid="npat-points" data-seat-id={s.id} data-points={p}>
                <Avatar seat={s} size={28} />
                <span className="flex-1 truncate font-black">{s.name}</span>
                <span className="text-xl font-black tabular-nums">+{p}</span>
              </li>
            ))}
        </ol>
      )}
    </>
  );
}
