'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJson, postJson, type Me } from '@/client/api';
import { GAME_META } from '@/games/meta';

interface Overview {
  crew: { id: string; name: string; inviteToken: string };
  members: { identityId: string; name: string; stats: { gameType: string; played: number; wins: number; averageRank: number; extra: Record<string, number> }[] }[];
  seasons: string[];
  season: string;
  leaderboard: { identityId: string; name: string; points: number; games: number; wins: number; average: number; rank: number }[];
  nights: { roomId: string; date: string; awards: { award: string; name: string; emoji: string }[]; games: { gameId: string; winners: string[] }[] }[];
}

const EXTRA_LABEL: Record<string, string> = {
  accuracy: '% correct',
  avgDrawerPoints: 'pts per drawing',
  placesNamed: 'places named',
  imposterWinRate: '% wins as imposter',
  actedGuessed: 'acted & guessed',
  votesReceived: 'votes received',
};

function monthLabel(s: string) {
  const [y, m] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function CrewInvite({ token }: { token: string }) {
  const [crew, setCrew] = useState<{ id: string; name: string } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    getJson(`/api/crews/invite/${token}`).then((r) => (r.ok ? setCrew(r.crew) : setError('This invite link is not valid')));
    getJson<Me>('/api/identity/me').then((m) => {
      setMe(m);
      if (m.identity) setName(m.identity.name);
    });
  }, [token]);
  const join = async () => {
    if (!me?.identity || me.identity.name !== name.trim()) {
      const g = await postJson('/api/identity/guest', { name: name.trim() });
      if (!g.ok) return setError('Pick a name (1–24 characters)');
    }
    const r = await postJson(`/api/crews/invite/${token}`, {});
    if (r.ok) router.push(`/crews/${r.crew.id}`);
    else setError('Could not join');
  };
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6" data-testid="crew-invite" data-ready={crew && me ? 'true' : 'false'}>
      <h1 className="text-3xl font-black">Join {crew?.name ?? 'the crew'}</h1>
      <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Your name" data-testid="crew-join-name" />
      <button className="btn btn-brand" disabled={!crew} onClick={join} data-testid="crew-join">
        Join crew
      </button>
      {me?.identity?.kind === 'guest' && <p className="text-sm font-semibold text-muted">Tip: sign in so your crew stats follow you to every device.</p>}
      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
    </main>
  );
}

export function CrewPage({ id }: { id: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [h2h, setH2h] = useState<{ a: string; b: string; r?: { together: number; aAhead: number; bAhead: number; tied: number } }>({ a: '', b: '' });
  const router = useRouter();
  useEffect(() => {
    getJson(`/api/crews/${id}${season ? `?season=${season}` : ''}`).then((r) => {
      if (r.ok) setData(r);
      else setError(r.code === 'NOT_SEATED' ? 'Join this crew with its invite link to see the page.' : 'Crew not found');
    });
  }, [id, season]);
  useEffect(() => {
    if (!h2h.a || !h2h.b || h2h.a === h2h.b) return;
    getJson(`/api/crews/${id}/h2h?a=${h2h.a}&b=${h2h.b}`).then((r) => r.ok && setH2h((x) => ({ ...x, r: r.h2h })));
  }, [id, h2h.a, h2h.b]);

  if (error) return <main className="mx-auto max-w-md p-6 font-bold">{error}</main>;
  if (!data) return <main className="p-8 text-center font-black text-muted">Loading…</main>;
  const invite = typeof window !== 'undefined' ? `${window.location.origin}/c/${data.crew.inviteToken}` : '';
  const nameOf = (identityId: string) => data.members.find((m) => m.identityId === identityId)?.name ?? '?';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6" data-testid="crew-page">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-black" data-testid="crew-title">
          {data.crew.name}
        </h1>
        <Link className="btn btn-ghost !min-h-11 text-sm" href="/">
          Home
        </Link>
      </header>
      <div className="card flex flex-col gap-2 p-4">
        <span className="text-xs font-black uppercase tracking-wide text-muted">Invite link</span>
        <input className="input text-sm" readOnly value={invite} aria-label="Crew invite link" data-testid="crew-invite-link" />
        <button
          className="btn btn-brand"
          onClick={async () => {
            const r = await postJson('/api/rooms', { crewId: data.crew.id });
            if (r.ok) router.push(`/r/${r.code}`);
          }}
          data-testid="crew-start-night"
        >
          🎉 Start a game night
        </button>
      </div>

      <section className="card p-4" aria-label="Season leaderboard">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-black">Season</h2>
          <select className="input !min-h-11 !w-auto" value={data.season} onChange={(e) => setSeason(e.target.value)} aria-label="Season" data-testid="season-select">
            {[...new Set([data.season, ...data.seasons])].map((s) => (
              <option key={s} value={s}>
                {monthLabel(s)}
              </option>
            ))}
          </select>
        </div>
        {data.leaderboard.length === 0 ? (
          <p className="font-semibold text-muted">No games this season yet.</p>
        ) : (
          <table className="w-full text-left" data-testid="leaderboard">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th>#</th>
                <th>Player</th>
                <th className="text-right">Pts</th>
                <th className="text-right">Games</th>
                <th className="text-right">Wins</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((r) => (
                <tr key={r.identityId} className="font-bold" data-testid="leaderboard-row">
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  <td className="text-right font-black">{r.points}</td>
                  <td className="text-right">{r.games}</td>
                  <td className="text-right">{r.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4" aria-label="Stats">
        <h2 className="mb-2 text-lg font-black">Stats</h2>
        {data.members.map((m) => (
          <details key={m.identityId} className="border-b border-line py-2" data-testid="member-stats">
            <summary className="cursor-pointer font-black">{m.name}</summary>
            <ul className="mt-1 text-sm font-semibold">
              {m.stats.map((s) => (
                <li key={s.gameType}>
                  {GAME_META[s.gameType]?.title ?? s.gameType}: {s.played} played · {s.wins} won · avg rank {s.averageRank}
                  {Object.entries(s.extra).map(([k, v]) => ` · ${v} ${EXTRA_LABEL[k] ?? k}`)}
                </li>
              ))}
            </ul>
          </details>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="h2h">
          <span className="font-black">Head-to-head</span>
          {(['a', 'b'] as const).map((k) => (
            <select key={k} className="input !min-h-11 !w-auto" value={h2h[k]} onChange={(e) => setH2h({ ...h2h, [k]: e.target.value, r: undefined })} aria-label={`Player ${k.toUpperCase()}`}>
              <option value="">Pick…</option>
              {data.members.map((m) => (
                <option key={m.identityId} value={m.identityId}>
                  {m.name}
                </option>
              ))}
            </select>
          ))}
          {h2h.r && (
            <p className="w-full font-bold" data-testid="h2h-result">
              {h2h.r.together} games together · {nameOf(h2h.a)} ahead {h2h.r.aAhead} · {nameOf(h2h.b)} ahead {h2h.r.bAhead} · tied {h2h.r.tied}
            </p>
          )}
        </div>
      </section>

      <section className="card p-4" aria-label="History">
        <h2 className="mb-2 text-lg font-black">History</h2>
        {data.nights.length === 0 && <p className="font-semibold text-muted">No nights yet. Start one above!</p>}
        <ul className="flex flex-col gap-3" data-testid="crew-history">
          {data.nights.map((n) => (
            <li key={n.roomId} className="rounded-2xl border-2 border-line p-3" data-testid="crew-night">
              <div className="font-black" data-testid="night-date">
                {n.date}
              </div>
              <ul className="text-sm font-semibold">
                {n.games.map((g, i) => (
                  <li key={i}>
                    {GAME_META[g.gameId]?.title ?? g.gameId}: <b>{g.winners.join(', ')}</b>
                  </li>
                ))}
              </ul>
              {n.awards.length > 0 && (
                <p className="mt-1 text-sm font-bold text-muted" data-testid="night-awards">
                  {n.awards.map((a) => `${a.emoji} ${a.award}: ${a.name}`).join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
