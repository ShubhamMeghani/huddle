'use client';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '@/client/api';
import type { RoomProps } from './ui';

/** Admin: link tonight's room to a crew so results count for its season (R48). */
export function CrewLink({ state }: Pick<RoomProps, 'state'>) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const [crews, setCrews] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (me.isAdmin) getJson('/api/crews').then((r) => setCrews(r.crews ?? []));
  }, [me.isAdmin]);
  const linked = crews.find((c) => c.id === pub.crewId);
  if (!me.isAdmin) return linked ? <p className="text-sm font-bold text-muted">Counts for {linked.name}</p> : null;
  if (!crews.length) return null;
  return (
    <label className="card flex items-center justify-between gap-3 p-4 font-bold" htmlFor="crew-link">
      <span>Crew</span>
      <select
        id="crew-link"
        className="input !min-h-12 !w-auto"
        value={pub.crewId ?? ''}
        onChange={(e) => void postJson(`/api/rooms/${pub.code}/crew`, { crewId: e.target.value || null })}
        data-testid="crew-link"
      >
        <option value="">Not linked</option>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
