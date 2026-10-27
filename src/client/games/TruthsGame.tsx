'use client';
import { useEffect, useRef, useState } from 'react';
import { Avatar, seatName, type RoomProps } from '@/client/components/ui';

interface TruthsView {
  doneIds: string[];
  order: string[];
  turn: number;
  subject: string | null;
  statements: string[] | null;
  votedIds: string[];
  reveal: { lie: number; counts: number[]; votes: Record<string, number>; points: Record<string, number> } | null;
}
interface TruthsPrivate {
  mine?: { texts: string[]; lie: number | null } | null;
  done?: boolean;
  myVote?: number | null;
  myLie?: number | null;
}

export function TruthsGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as TruthsView;
  const priv = (me.game ?? {}) as TruthsPrivate;
  const kind = pub.phase.kind;
  const players = pub.seats.filter((s) => s.status === 'seated');

  if (kind === 'write') {
    return (
      <div className="flex flex-col gap-3" data-testid="truths">
        <p className="text-center font-bold text-muted" data-testid="truths-done-count">
          {v.doneIds.length}/{players.length} ready
        </p>
        {me.role === 'player' ? (
          <WriteForm key={pub.game!.gameNo} sync={sync} state={state} mine={priv.mine ?? null} done={Boolean(priv.done)} />
        ) : (
          <p className="card p-5 text-center text-lg font-black" data-testid="truths-writing">
            ✍️ Everyone is writing two truths and a lie…
          </p>
        )}
      </div>
    );
  }

  const subject = pub.seats.find((s) => s.id === v.subject);
  const isSubject = v.subject === me.seatId;
  const canVote = kind === 'vote' && me.role === 'player' && !isSubject && priv.myVote == null && !pub.paused;
  return (
    <div className="flex flex-col gap-3" data-testid="truths">
      <div className="card flex items-center gap-3 p-4">
        {subject && <Avatar seat={subject} size={44} />}
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wide text-muted">
            Player {v.turn + 1} of {v.order.length}
          </div>
          <h2 className="text-xl font-black" data-testid="truths-subject">
            {isSubject ? 'Your statements: can they spot the lie?' : `Which is ${seatName(pub, v.subject)}’s lie?`}
          </h2>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {(v.statements ?? []).map((text, i) => {
          const isLie = v.reveal?.lie === i;
          const picked = priv.myVote === i;
          return (
            <button
              key={i}
              className={`btn min-h-16 w-full flex-col !items-start !gap-1 !rounded-2xl text-left text-lg ${isLie || picked ? 'btn-primary' : 'btn-ghost'}`}
              style={{ opacity: v.reveal || priv.myVote != null || isSubject ? 1 : undefined }}
              disabled={!canVote}
              aria-pressed={picked}
              onClick={() => void sync.act('vote', { choice: i })}
              data-testid={`truths-choice-${i}`}
              data-lie={v.reveal ? String(isLie) : undefined}
            >
              <span>{text}</span>
              {isSubject && priv.myLie === i && <span className="text-sm font-black">🤥 your lie</span>}
              {v.reveal && (
                <span className="text-sm font-black" data-testid={`truths-count-${i}`}>
                  {isLie ? '🤥 The lie · ' : ''}
                  {v.reveal.counts[i]} vote{v.reveal.counts[i] === 1 ? '' : 's'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {kind === 'vote' && (
        <p className="text-center font-bold text-muted" data-testid="truths-voted">
          {priv.myVote != null ? '🔒 Vote locked in · ' : ''}
          {v.votedIds.length}/{Math.max(0, players.length - 1)} voted
        </p>
      )}
      {v.reveal && (
        <ol className="reveal-card card flex flex-col gap-2 p-4" data-testid="truths-reveal" data-reveal-card="true">
          {Object.entries(v.reveal.points)
            .sort((a, b) => b[1] - a[1])
            .map(([id, p]) => {
              const seat = pub.seats.find((s) => s.id === id);
              return (
                <li key={id} className="flex items-center gap-3" data-testid="truths-points" data-seat-id={id} data-points={p}>
                  {seat && <Avatar seat={seat} size={28} />}
                  <span className="flex-1 truncate font-black">{seat?.name}</span>
                  <span className="text-xl font-black tabular-nums">+{p}</span>
                </li>
              );
            })}
        </ol>
      )}
    </div>
  );
}

function WriteForm({ sync, state, mine, done }: RoomProps & { mine: { texts: string[]; lie: number | null } | null; done: boolean }) {
  const me = state.snapshot!.me;
  const [texts, setTexts] = useState<string[]>(mine?.texts ?? ['', '', '']);
  const [lie, setLie] = useState<number | null>(mine?.lie ?? null);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(JSON.stringify({ texts: mine?.texts ?? ['', '', ''], lie: mine?.lie ?? null }));
  const canWrite = me.role === 'player' && !done && !state.snapshot!.public.paused;

  // Drafts are saved a second after typing stops, so they survive a reload or the timer ending.
  useEffect(() => {
    const now = JSON.stringify({ texts, lie });
    if (!canWrite || now === saved.current) return;
    const t = setTimeout(() => {
      saved.current = now;
      void sync.act('fill', { texts, lie });
    }, 1000);
    return () => clearTimeout(t);
  }, [texts, lie, canWrite, sync]);

  if (done) {
    return (
      <div className="card p-5 text-center" data-testid="truths-locked">
        <p className="text-lg font-black">🔒 Locked in. Waiting for the others…</p>
      </div>
    );
  }
  return (
    <form
      className="card flex flex-col gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const r = await sync.act('submit', { texts, lie });
        if (!r.ok) setError(r.message ?? 'Not accepted');
      }}
      data-testid="truths-form"
    >
      <p className="font-bold text-muted">Two truths and one lie about you. Tap the lie.</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <label htmlFor={`truths-${i}`} className="font-black">
            Statement {i + 1}
          </label>
          <input
            id={`truths-${i}`}
            className="input"
            value={texts[i]}
            maxLength={80}
            autoComplete="off"
            disabled={!canWrite}
            onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
            data-testid={`truths-input-${i}`}
          />
          <button
            type="button"
            className={`btn self-start !px-3 text-sm ${lie === i ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={lie === i}
            disabled={!canWrite}
            onClick={() => setLie(i)}
            data-testid={`truths-lie-${i}`}
          >
            {lie === i ? '🤥 This is my lie' : 'Mark as the lie'}
          </button>
        </div>
      ))}
      <button className="btn btn-primary w-full text-lg" type="submit" disabled={!canWrite} data-testid="truths-submit">
        Submit
      </button>
      {error && (
        <p role="alert" className="font-bold text-danger" data-testid="truths-error">
          {error}
        </p>
      )}
    </form>
  );
}
