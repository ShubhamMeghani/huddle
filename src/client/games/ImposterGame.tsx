'use client';
import { useState } from 'react';
import { Avatar, seatName, type RoomProps } from '@/client/components/ui';

interface ImposterView {
  round: number;
  rounds: number;
  clueRounds: number;
  players: string[];
  order: string[];
  clues: { seatId: string; round: number; text: string }[];
  ready: string[];
  votedIds: string[];
  revoteCandidates: string[] | null;
  tally: Record<string, number> | null;
  accused: string | null;
  reveal: { imposters: string[]; crewWord: string; imposterWord: string; outcome: 'crew' | 'imposter' | 'steal'; guess: string | null } | null;
}

export function ImposterGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as ImposterView;
  const mine = (me.game ?? {}) as { word?: string; isImposter?: boolean | null; myVote?: string | null; ready?: boolean; mustAct?: boolean };
  const kind = pub.phase.kind;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const playing = me.seatId && v.players.includes(me.seatId);

  const submit = async (type: 'clue' | 'guess') => {
    setError(null);
    const r = await sync.act(type, { text: text.trim() });
    if (!r.ok) setError(r.message ?? 'Try another word');
    else setText('');
  };

  return (
    <div className="flex flex-col gap-3" data-testid="imposter">
      <p className="text-sm font-black uppercase tracking-wide text-muted">
        Round {v.round}/{v.rounds}
      </p>
      {playing && mine.word && kind !== 'reveal' && (
        <div className="card p-4 text-center" data-testid="imposter-word-card">
          <div className="text-xs font-black uppercase tracking-wide text-muted">Your secret word</div>
          <div className="text-3xl font-black text-accent-ink" data-testid="imposter-word">
            {mine.word}
          </div>
          {mine.isImposter && <div className="mt-1 font-black text-danger">You are the imposter! Blend in.</div>}
        </div>
      )}

      <section className="card p-4" aria-label="Clues">
        <h3 className="mb-2 font-black">Clues</h3>
        <ul className="flex flex-col gap-1" data-testid="imposter-clues">
          {v.order.map((id) => {
            const clues = v.clues.filter((c) => c.seatId === id);
            const seat = pub.seats.find((s) => s.id === id);
            return (
              <li key={id} className={`flex items-center gap-2 ${pub.phase.turnSeatId === id && kind === 'clue' ? 'font-black' : ''}`}>
                {seat && <Avatar seat={seat} size={28} />}
                <span className="w-24 truncate font-bold">{seat?.name}</span>
                <span className="flex flex-wrap gap-1">
                  {clues.map((c, i) => (
                    <span key={i} className="rounded-full bg-accent-soft px-2 text-sm font-bold" data-testid="clue">
                      {c.text}
                    </span>
                  ))}
                  {clues.length === 0 && kind === 'clue' && (
                    <span className="text-sm font-semibold text-muted">{pub.phase.turnSeatId === id ? 'thinking…' : 'waiting'}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {kind === 'clue' && pub.phase.turnSeatId === me.seatId && (
        <form
          className="card flex flex-col gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit('clue');
          }}
        >
          <label htmlFor="clue" className="font-black">
            Your one-word clue
          </label>
          <div className="flex gap-2">
            <input id="clue" className="input" value={text} maxLength={20} autoComplete="off" onChange={(e) => setText(e.target.value)} data-testid="clue-input" />
            <button className="btn btn-primary" type="submit" data-testid="clue-send">
              Send
            </button>
          </div>
        </form>
      )}

      {kind === 'discuss' && playing && (
        <div className="card flex flex-col gap-2 p-4 text-center">
          <p className="text-lg font-black">Discuss! Who has a different word?</p>
          <button className="btn btn-primary" disabled={mine.ready} onClick={() => void sync.act('ready')} data-testid="imposter-ready">
            {mine.ready ? 'Waiting for others…' : 'Ready to vote'}
          </button>
          <p className="text-sm font-bold text-muted">
            {v.ready.length}/{v.players.length} ready
          </p>
        </div>
      )}

      {(kind === 'vote' || kind === 'revote') && playing && (
        <div className="card flex flex-col gap-2 p-4" data-testid="imposter-vote">
          <p className="text-lg font-black">{kind === 'revote' ? 'Tie! Revote between:' : 'Vote for the imposter'}</p>
          {(v.revoteCandidates ?? v.players)
            .filter((id) => id !== me.seatId)
            .map((id) => {
              const seat = pub.seats.find((s) => s.id === id);
              return (
                <button
                  key={id}
                  className={`btn justify-start ${mine.myVote === id ? 'btn-primary' : 'btn-ghost'}`}
                  disabled={Boolean(mine.myVote)}
                  onClick={() => void sync.act('vote', { seatId: id })}
                  data-testid="vote-for"
                  data-seat-id={id}
                >
                  {seat && <Avatar seat={seat} size={28} />} {seat?.name}
                </button>
              );
            })}
          <p className="text-sm font-bold text-muted">
            {v.votedIds.length}/{v.players.length} voted
          </p>
        </div>
      )}

      {kind === 'guess' && (
        <div className="card flex flex-col gap-2 p-4 text-center" data-testid="imposter-guess">
          <p className="text-lg font-black">{seatName(pub, v.accused)} was caught! One guess at the crew’s word to steal the win.</p>
          {pub.phase.turnSeatId === me.seatId && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit('guess');
              }}
            >
              <input className="input" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} data-testid="guess-word-input" />
              <button className="btn btn-primary" type="submit" data-testid="guess-word-send">
                Guess
              </button>
            </form>
          )}
        </div>
      )}

      {kind === 'reveal' && v.reveal && (
        <div className="reveal-card card flex flex-col gap-2 p-5 text-center" data-testid="imposter-reveal" data-outcome={v.reveal.outcome} data-reveal-card="true">
          <div className="text-5xl">{v.reveal.outcome === 'crew' ? '🎉' : '🕵️'}</div>
          <p className="text-2xl font-black" data-testid="imposter-outcome">
            {v.reveal.outcome === 'crew' ? 'The crew caught the imposter!' : v.reveal.outcome === 'steal' ? 'Imposter steals the win!' : 'The imposter got away!'}
          </p>
          <p className="font-bold">
            Imposter: {v.reveal.imposters.map((id) => seatName(pub, id)).join(' & ')}
          </p>
          <p className="font-bold">
            Crew word: <span className="text-accent-ink">{v.reveal.crewWord}</span> · Imposter word: <span className="text-accent-ink">{v.reveal.imposterWord}</span>
          </p>
          {v.reveal.guess && <p className="text-sm font-bold text-muted">Imposter guessed “{v.reveal.guess}”</p>}
          {v.tally && (
            <ul className="mt-2 text-sm font-bold" data-testid="imposter-tally">
              {Object.entries(v.tally).map(([id, n]) => (
                <li key={id}>
                  {seatName(pub, id)}: {n} vote{n === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="font-bold text-danger" data-testid="imposter-error">
          {error}
        </p>
      )}
    </div>
  );
}
