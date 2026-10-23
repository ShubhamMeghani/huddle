'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJson, postJson, type Me } from '@/client/api';

export function ClaimBanner() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="card flex flex-col gap-2 p-4" data-testid="claim-banner">
      <p className="font-bold">You played as a guest on this phone. Move those games and ratings to your account?</p>
      {done ? (
        <p className="font-black text-success" data-testid="claim-done">
          {done}
        </p>
      ) : (
        <button
          className="btn btn-brand"
          onClick={async () => {
            const r = await postJson('/api/identity/claim', {});
            setDone(r.ok ? (r.claimed ? `Claimed ${r.games} game${r.games === 1 ? '' : 's'}!` : 'Already claimed') : 'Could not claim');
          }}
          data-testid="claim-guest"
        >
          Claim my guest games
        </button>
      )}
    </div>
  );
}

export function CrewsHome({ me, ensureName }: { me: Me | null; ensureName: () => Promise<boolean> }) {
  const [crews, setCrews] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (me?.identity) getJson('/api/crews').then((r) => setCrews(r.crews ?? []));
  }, [me?.identity]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await ensureName())) return;
    const r = await postJson('/api/crews', { name });
    if (r.ok) router.push(`/crews/${r.crew.id}`);
  };
  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="Crews">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">Your crews</h2>
        <button className="btn btn-ghost !min-h-11 text-sm" onClick={() => setOpen(!open)} data-testid="crew-new">
          ＋ New crew
        </button>
      </div>
      {crews.length === 0 && <p className="text-sm font-semibold text-muted">A crew keeps a season leaderboard, stats and history for your friend group.</p>}
      <ul className="flex flex-col gap-2">
        {crews.map((c) => (
          <li key={c.id}>
            <Link href={`/crews/${c.id}`} className="font-bold underline" data-testid="crew-item">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      {open && (
        <form className="flex gap-2" onSubmit={create}>
          <input className="input" value={name} maxLength={40} placeholder="e.g. Hostel 4B" onChange={(e) => setName(e.target.value)} aria-label="Crew name" data-testid="crew-name" />
          <button className="btn btn-brand" type="submit" data-testid="crew-create">
            Create
          </button>
        </form>
      )}
    </section>
  );
}
