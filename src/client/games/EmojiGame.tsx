'use client';
import { useState } from 'react';
import { seatName, type RoomProps } from '@/client/components/ui';
import { EMOJI_CATEGORY_LABEL } from '@/games/emoji/meta';

interface EmojiView {
  idx: number;
  total: number;
  emoji: string;
  category: string;
  solved: { seatId: string; ms: number }[];
  answer: string | null;
  points: Record<string, number> | null;
}

export function EmojiGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as EmojiView;
  const solved = Boolean((me.game as { solved?: boolean } | null)?.solved);
  const canGuess = pub.phase.kind === 'puzzle' && me.role === 'player' && !solved && !pub.paused;
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<{ idx: number; text: string } | null>(null);
  const players = pub.seats.filter((s) => s.status === 'seated');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const guess = text.trim();
    if (!guess) return;
    const r = await sync.act('guess', { text: guess });
    const priv = r.private as { correct?: boolean; points?: number } | null | undefined;
    if (priv?.correct) {
      setText('');
      setFeedback({ idx: v.idx, text: `✓ Correct! +${priv.points}` });
    } else if (r.ok) setFeedback({ idx: v.idx, text: `“${guess}” isn’t it. Keep trying!` });
    else setFeedback({ idx: v.idx, text: r.code === 'RATE_LIMITED' ? 'Slow down a little.' : (r.message ?? 'Not accepted') });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="emoji">
      <div className="card flex flex-col items-center gap-2 p-5 text-center">
        <div className="flex w-full justify-between text-sm font-black uppercase tracking-wide text-muted">
          <span data-testid="emoji-progress">
            Puzzle {v.idx + 1} / {v.total}
          </span>
          <span data-testid="emoji-category">{EMOJI_CATEGORY_LABEL[v.category] ?? v.category}</span>
        </div>
        <div className="py-2 text-6xl leading-tight" role="img" aria-label="Emoji puzzle" data-testid="emoji-clue">
          {v.emoji}
        </div>
      </div>

      {pub.phase.kind === 'puzzle' && me.role === 'player' && (
        <form className="card flex flex-col gap-2 p-4" onSubmit={send}>
          {solved ? (
            <p className="text-lg font-black text-accent-ink" data-testid="emoji-solved-me">
              ✓ You got it! Waiting for the others…
            </p>
          ) : (
            <>
              <label htmlFor="emoji-guess" className="font-black">
                Your answer
              </label>
              <div className="flex gap-2">
                <input
                  id="emoji-guess"
                  className="input"
                  value={text}
                  maxLength={60}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="send"
                  disabled={!canGuess}
                  onChange={(e) => setText(e.target.value)}
                  data-testid="emoji-input"
                />
                <button className="btn btn-primary" type="submit" disabled={!canGuess} data-testid="emoji-send">
                  Go
                </button>
              </div>
            </>
          )}
          {feedback?.idx === v.idx && (
            <p role="status" className="font-bold" data-testid="emoji-feedback">
              {feedback.text}
            </p>
          )}
        </form>
      )}

      {v.answer && (
        <div className="reveal-card card flex flex-col gap-1 p-5 text-center" data-testid="emoji-reveal" data-reveal-card="true">
          <div className="text-sm font-black uppercase tracking-wide text-muted">The answer</div>
          <div className="text-3xl font-black" data-testid="emoji-answer">
            {v.answer}
          </div>
          <p className="font-bold" data-testid="emoji-my-points">
            {me.seatId && v.points?.[me.seatId] ? `+${v.points[me.seatId]} points` : me.role === 'player' ? 'No points this time' : ''}
          </p>
        </div>
      )}

      <section className="card p-4" aria-label="Who solved it">
        <p className="mb-2 text-sm font-black uppercase tracking-wide text-muted">
          Solved {v.solved.length}/{players.length}
        </p>
        {v.solved.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Nobody yet.</p>
        ) : (
          <ol className="flex flex-wrap gap-2" data-testid="emoji-solved">
            {v.solved
              .slice()
              .sort((a, b) => a.ms - b.ms)
              .map((x) => (
                <li key={x.seatId} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold">
                  {seatName(pub, x.seatId)} got it!
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
