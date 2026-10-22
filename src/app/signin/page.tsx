import Link from 'next/link';
import { signIn } from '@/server/auth';
import { googleEnabled, isTestMode } from '@/server/env';

export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/';
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-3xl font-black">Sign in (optional)</h1>
      <p className="font-semibold text-muted">
        Guests can play without an account. Signing in keeps your seat and stats on every device.
      </p>
      {googleEnabled() && (
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo });
          }}
        >
          <button className="btn btn-brand w-full text-lg" type="submit" data-testid="google-signin">
            Continue with Google
          </button>
        </form>
      )}
      {isTestMode() && (
        <form
          className="card flex flex-col gap-3 p-5"
          action={async (fd: FormData) => {
            'use server';
            await signIn('test', { email: String(fd.get('email') ?? ''), name: String(fd.get('name') ?? ''), redirectTo });
          }}
        >
          <input className="input" name="email" placeholder="test email" data-testid="test-email" />
          <input className="input" name="name" placeholder="name" data-testid="test-name" />
          <button className="btn btn-ghost" type="submit" data-testid="test-signin">
            Test sign-in
          </button>
        </form>
      )}
      {!googleEnabled() && !isTestMode() && <p className="font-bold">Sign-in is not configured yet.</p>}
      <p className="text-sm font-semibold text-muted">
        See our <Link href="/privacy" className="underline">privacy page</Link> for what we store.
      </p>
    </main>
  );
}
