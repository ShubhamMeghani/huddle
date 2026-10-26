'use client';
import { useState } from 'react';
import { defaultsOf } from '@/games/settings';
import { pickForUs } from '@/games/pick';
import type { GameConfig } from '@/engine/types';
import type { RoomProps } from './ui';

/** "Pick for us" (R96): adds a game the seated players can start, preferring ones not played tonight. */
export function PickForUs({ state, onAdd }: Pick<RoomProps, 'state'> & { onAdd: (cfg: GameConfig) => Promise<boolean> }) {
  const pub = state.snapshot!.public;
  const [message, setMessage] = useState<string | null>(null);
  const players = pub.seats.filter((s) => s.status === 'seated').length;
  const pick = async () => {
    const avoid = [...pub.queue.map((q) => q.gameId), ...pub.night.map((g) => g.gameId)];
    const g = pickForUs(players, avoid);
    if (!g) return setMessage('You need at least 2 players for any game.');
    if (await onAdd({ gameId: g.id, settings: defaultsOf(g.settings) })) setMessage(`Picked ${g.emoji} ${g.title}: it fits ${players} players.`);
  };
  return (
    <div className="flex flex-col gap-1">
      <button className="btn btn-brand w-full" onClick={() => void pick()} data-testid="pick-for-us">
        🎲 Pick for us
      </button>
      {message && (
        <p role="status" className="text-center text-sm font-bold" data-testid="pick-message">
          {message}
        </p>
      )}
    </div>
  );
}
