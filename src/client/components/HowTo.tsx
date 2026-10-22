'use client';
import { GAME_META } from '@/games/meta';
import { Sheet } from './ui';

export function HowToContent({ gameId }: { gameId: string }) {
  const m = GAME_META[gameId];
  if (!m) return null;
  const sections: [string, string[]][] = [
    ['Rules', m.howTo.rules],
    ['Scoring', m.howTo.scoring],
    ['Timers', m.howTo.timers],
  ];
  return (
    <div className="flex flex-col gap-4" data-game={gameId} data-testid="howto">
      {sections.map(([title, items]) => (
        <section key={title} data-testid={`howto-${title.toLowerCase()}`}>
          <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-muted">{title}</h3>
          <ul className="list-disc space-y-1 pl-5 font-semibold">
            {items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function HowToSheet({ gameId, open, onClose }: { gameId: string; open: boolean; onClose: () => void }) {
  const m = GAME_META[gameId];
  return (
    <Sheet open={open} onClose={onClose} title={`How to play ${m?.title ?? ''}`} testId="howto-sheet">
      <HowToContent gameId={gameId} />
    </Sheet>
  );
}
