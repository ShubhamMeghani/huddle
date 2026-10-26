'use client';
import { GAME_META } from '@/games/meta';
import type { RoomProps } from './ui';

/** How-to-play card before a game's first round in this room (R95): three lines, one example, skippable. */
export function IntroCard({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const game = pub.game!;
  const meta = GAME_META[game.id];
  const ready = game.intro?.ready ?? [];
  const humans = pub.seats.filter((s) => s.status === 'seated' && !s.isBot && !s.afk);
  const iAmReady = Boolean(me.game?.introReady);
  if (!meta?.intro) return null;
  return (
    <section className="reveal-card card flex flex-col gap-4 p-5" data-game={game.id} data-testid="intro-card" aria-label={`How to play ${meta.title}`}>
      <h2 className="flex items-center gap-3 text-2xl font-black">
        <span className="text-4xl" aria-hidden>
          {meta.emoji}
        </span>
        <span>How to play {meta.title}</span>
      </h2>
      <ol className="flex flex-col gap-2" data-testid="intro-lines">
        {meta.intro.lines.map((line, i) => (
          <li key={i} className="flex items-start gap-3 text-lg font-bold leading-snug">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-black text-on-accent">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl bg-accent-soft p-4" data-testid="intro-example">
        <div className="text-xs font-black uppercase tracking-wide">Example</div>
        <p className="font-semibold">{meta.intro.example}</p>
      </div>
      {me.role === 'player' && (
        <button className="btn btn-primary w-full text-lg" disabled={iAmReady} onClick={() => void sync.act('introReady')} data-testid="intro-skip">
          {iAmReady ? '✓ Ready' : 'Got it, let’s play'}
        </button>
      )}
      <p className="text-center text-sm font-bold text-muted" data-testid="intro-ready-count">
        {ready.length}/{humans.length} ready · starts when everyone is, or when the timer ends
      </p>
    </section>
  );
}
