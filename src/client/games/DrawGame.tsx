'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomProps } from '@/client/components/ui';
import { seatName } from '@/client/components/ui';
import { PALETTE, SIZES } from '@/lib/strokes';
import { DrawCanvas, type Tool } from './draw/Canvas';

interface Msg {
  id: number;
  seatId: string | null;
  text: string | null;
  kind: 'guess' | 'correct' | 'system';
}
interface DrawView {
  round: number;
  rounds: number;
  drawerId: string | null;
  turnId: string;
  mask: string[];
  guessedIds: string[];
  chat: Msg[];
  lastWord: string | null;
}

export function DrawGame({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const v = pub.game!.view as DrawView;
  const mine = (me.game ?? {}) as { drawer?: boolean; choices?: string[]; word?: string | null; guessed?: boolean; secretChat?: Msg[] };
  const kind = pub.phase.kind;
  const isDrawer = Boolean(mine.drawer) && me.seatId === v.drawerId;
  const [tool, setTool] = useState<Tool>({ color: 0, size: 1, eraser: false });
  const [text, setText] = useState('');
  const [toast, setToast] = useState<{ kind: 'close' | 'correct'; text: string } | null>(null);
  const api = useRef<{ undo: () => void; clear: () => void } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const onApi = useCallback((a: { undo: () => void; clear: () => void }) => {
    api.current = a;
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [v.chat.length, mine.secretChat?.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const sendGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    const r = await sync.act('guess', { text: t });
    const priv = r.private as { close?: boolean; correct?: boolean; points?: number } | null | undefined;
    if (priv?.close) setToast({ kind: 'close', text: 'You’re close!' });
    if (priv?.correct) setToast({ kind: 'correct', text: `You got it! +${priv.points}` });
  };

  const messages = [...v.chat, ...(mine.secretChat ?? []).map((m) => ({ ...m, secret: true }))].sort((a, b) => a.id - b.id) as (Msg & { secret?: boolean })[];

  return (
    <div className="flex flex-col gap-3" data-testid="draw">
      <div className="flex items-center justify-between gap-2 font-black">
        <span className="text-sm uppercase tracking-wide text-muted">
          Round {v.round}/{v.rounds} · {isDrawer ? 'You draw' : `${seatName(pub, v.drawerId)} draws`}
        </span>
      </div>

      {isDrawer && mine.word && (
        <div className="rounded-2xl bg-accent px-4 py-2 text-center text-xl font-black text-on-accent" data-testid="draw-word">
          {mine.word}
        </div>
      )}
      {!isDrawer && v.mask.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 font-mono text-2xl font-black tracking-widest" aria-label={`Word with ${v.mask.filter((c) => c !== ' ').length} letters`} data-testid="draw-mask">
          {v.mask.map((c, i) => (
            <span key={i} className={c === ' ' ? 'w-3' : ''}>
              {c}
            </span>
          ))}
        </div>
      )}
      {!isDrawer && mine.guessed && mine.word && (
        <p className="text-center font-black text-success" data-testid="draw-you-guessed">
          ✓ You guessed: {mine.word}
        </p>
      )}

      {kind === 'choose' && isDrawer && (
        <div className="card flex flex-col gap-2 p-4" data-testid="draw-choices">
          <p className="font-black">Pick a word to draw</p>
          {(mine.choices ?? []).map((w, i) => (
            <button key={w} className="btn btn-primary text-lg" onClick={() => void sync.act('choose', { index: i })} data-testid={`draw-choice-${i}`}>
              {w}
            </button>
          ))}
        </div>
      )}
      {kind === 'choose' && !isDrawer && (
        <p className="card p-4 text-center font-bold" data-testid="draw-choosing">
          {seatName(pub, v.drawerId)} is choosing a word…
        </p>
      )}
      {kind === 'turnEnd' && v.lastWord && (
        <p className="card p-4 text-center text-xl font-black" data-testid="draw-reveal">
          The word was <span className="text-accent-ink">{v.lastWord}</span>
        </p>
      )}

      {(kind === 'draw' || kind === 'turnEnd') && (
        <DrawCanvas sync={sync} code={pub.code} turnId={v.turnId} isDrawer={isDrawer && kind === 'draw'} tool={tool} onApi={onApi} />
      )}

      {isDrawer && kind === 'draw' && (
        <div className="card flex flex-col gap-3 p-3" data-testid="draw-tools">
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Colour">
            {PALETTE.map((c, i) => (
              <button
                key={c}
                role="radio"
                aria-checked={tool.color === i && !tool.eraser}
                aria-label={`Colour ${i + 1}`}
                className="h-11 rounded-full border-2"
                style={{ background: c, borderColor: tool.color === i && !tool.eraser ? 'var(--ink)' : 'var(--line)' }}
                onClick={() => setTool({ ...tool, color: i, eraser: false })}
                data-testid={`color-${i}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SIZES.map((s, i) => (
              <button
                key={s}
                className={`btn !px-3 ${tool.size === i ? 'btn-primary' : 'btn-ghost'}`}
                aria-label={`Brush size ${i + 1}`}
                aria-pressed={tool.size === i}
                onClick={() => setTool({ ...tool, size: i })}
                data-testid={`size-${i}`}
              >
                <span className="inline-block rounded-full bg-current" style={{ width: 6 + i * 5, height: 6 + i * 5 }} />
              </button>
            ))}
            <button className={`btn !px-3 ${tool.eraser ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={tool.eraser} onClick={() => setTool({ ...tool, eraser: !tool.eraser })} data-testid="tool-eraser">
              🧽 Eraser
            </button>
            <button className="btn btn-ghost !px-3" onClick={() => api.current?.undo()} data-testid="tool-undo">
              ↩ Undo
            </button>
            <button className="btn btn-ghost !px-3" onClick={() => api.current?.clear()} data-testid="tool-clear">
              🗑 Clear
            </button>
          </div>
        </div>
      )}

      <div className="card flex flex-col gap-2 p-3" aria-label="Guesses">
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto" data-testid="draw-chat">
          {messages.map((m) => (
            <div
              key={`${m.secret ? 's' : 'p'}${m.id}`}
              className={`text-sm font-bold ${m.kind === 'correct' ? 'text-success' : m.kind === 'system' ? 'italic text-muted' : ''}`}
              data-testid={m.kind === 'correct' ? 'chat-correct' : m.secret ? 'chat-secret' : 'chat-line'}
            >
              {m.kind === 'correct' ? `✓ ${seatName(pub, m.seatId)} guessed it!` : m.kind === 'system' ? m.text : `${m.secret ? '🔒 ' : ''}${seatName(pub, m.seatId)}: ${m.text}`}
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        {!isDrawer && me.role === 'player' && kind === 'draw' && (
          <form className="flex gap-2" onSubmit={sendGuess}>
            <input
              className="input"
              value={text}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="send"
              placeholder={mine.guessed ? 'Chat with others who got it' : 'Type your guess'}
              onChange={(e) => setText(e.target.value)}
              aria-label="Your guess"
              data-testid="guess-input"
            />
            <button className="btn btn-primary" type="submit" data-testid="guess-send">
              Send
            </button>
          </form>
        )}
      </div>
      {toast && (
        <div role="status" className={`fixed left-1/2 top-1/3 z-30 -translate-x-1/2 rounded-2xl px-5 py-3 text-xl font-black shadow-lg ${toast.kind === 'close' ? 'bg-warn text-bg' : 'bg-success text-bg'}`} data-testid={toast.kind === 'close' ? 'close-toast' : 'correct-toast'}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
