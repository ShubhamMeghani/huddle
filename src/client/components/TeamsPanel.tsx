'use client';
import { Avatar, type RoomProps } from './ui';

/** Team editor (R32): admin can balance, shuffle and move players. Phase 3 adds rating-based balancing. */
export function TeamsPanel({ sync, state }: RoomProps) {
  const pub = state.snapshot!.public;
  const me = state.snapshot!.me;
  const teams = pub.teams;
  if (!teams?.length && !me.isAdmin) return null;
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Teams" data-testid="teams">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">Teams</h2>
        {me.isAdmin && (
          <div className="flex gap-2">
            <button className="btn btn-ghost !min-h-11 !px-3 text-sm" onClick={() => void sync.act('setTeams', { mode: 'balance', count: teams?.length ?? 2 })} data-testid="teams-balance">
              ⚖️ Balance
            </button>
            <button className="btn btn-ghost !min-h-11 !px-3 text-sm" onClick={() => void sync.act('setTeams', { mode: 'shuffle', count: teams?.length ?? 2 })} data-testid="teams-shuffle">
              🔀
            </button>
          </div>
        )}
      </div>
      {!teams?.length && <p className="font-semibold text-muted">Team games split players automatically. Tap Balance to preview.</p>}
      {teams?.map((t) => (
        <div key={t.id} data-testid="team" data-team-id={t.id}>
          <h3 className="font-black">{t.name}</h3>
          <ul className="mt-1 flex flex-wrap gap-2">
            {t.seatIds.map((id) => {
              const s = pub.seats.find((x) => x.id === id);
              if (!s) return null;
              const other = teams.find((x) => x.id !== t.id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-1 pr-2" data-testid="team-member" data-seat-id={id}>
                  <Avatar seat={s} size={28} />
                  <span className="text-sm font-bold">{s.name}</span>
                  {me.isAdmin && other && (
                    <button
                      className="ml-1 min-h-8 rounded-full px-2 text-sm font-black"
                      aria-label={`Move ${s.name} to ${other.name}`}
                      onClick={() => void sync.act('setTeams', { mode: 'move', seatId: id, teamId: other.id })}
                      data-testid={`move-${id}`}
                    >
                      ⇄
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
