'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getJson, postJson, type Me } from '@/client/api';
import { ThemeToggle } from './ThemeToggle';
import { ClaimBanner, CrewsHome } from './CrewsHome';
import { AccountBar, SignInButton } from './Account';

export function HomeClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<Me>('/api/identity/me').then((m) => {
      setMe(m);
      if (m.identity) setName(m.identity.name);
    });
  }, []);

  const ensureName = async (): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Pick a name first');
      return false;
    }
    if (me?.identity && me.identity.name === trimmed) return true;
    const r = await postJson('/api/identity/guest', { name: trimmed });
    if (!r.ok) {
      setError(r.message ?? 'That name does not work');
      return false;
    }
    return true;
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await ensureName())) return;
      const r = await postJson('/api/rooms', {});
      if (!r.ok) throw new Error(r.code);
      router.push(`/r/${r.code}`);
    } catch {
      setError('Could not create a room. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) return setError('Room codes are 4 letters');
    router.push(`/r/${c}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6" data-ready={me ? 'true' : 'false'} data-testid="home">
      <header className="flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight">
          Huddle<span className="text-brand">.</span>
        </h1>
        <div className="flex items-center gap-2">
          <SignInButton me={me} />
          <ThemeToggle />
        </div>
      </header>
      <AccountBar me={me} />
      <p className="text-lg font-semibold text-muted">Game night for your crew. Everyone plays on their own phone.</p>

      <section className="card flex flex-col gap-3 p-5">
        <label htmlFor="name" className="text-sm font-extrabold uppercase tracking-wide text-muted">
          Your name
        </label>
        <input
          id="name"
          className="input"
          value={name}
          maxLength={40}
          autoComplete="nickname"
          placeholder="e.g. Aarav"
          onChange={(e) => setName(e.target.value)}
          data-testid="name-input"
        />
        <button className="btn btn-brand w-full text-lg" onClick={create} disabled={busy} data-testid="create-room">
          🎉 Create a room
        </button>
      </section>

      <form className="card flex flex-col gap-3 p-5" onSubmit={join}>
        <label htmlFor="code" className="text-sm font-extrabold uppercase tracking-wide text-muted">
          Join with a code
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            className="input uppercase tracking-[0.3em]"
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, ''))}
            data-testid="code-input"
          />
          <button className="btn btn-ghost" type="submit" data-testid="join-code">
            Join
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}

      {me?.identity?.kind === 'user' && me.identity.guestId && <ClaimBanner />}
      <CrewsHome me={me} ensureName={ensureName} />

      <Link href="/demo" className="btn btn-ghost w-full" data-testid="demo-link">
        🤖 Play alone with bots (demo)
      </Link>

      <nav className="mt-auto flex flex-wrap items-center justify-center gap-4 pt-4 text-sm font-bold text-muted">
        {me?.google || me?.testSignIn ? <Link href="/signin">Sign in</Link> : null}
        <Link href="/privacy">Privacy</Link>
      </nav>
    </main>
  );
}
