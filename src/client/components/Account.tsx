'use client';
import Link from 'next/link';
import type { Me } from '@/client/api';
import { signOutAction } from '@/app/account-actions';

const canSignIn = (me: Me | null) => Boolean(me && me.identity?.kind !== 'user' && (me.google || me.testSignIn));

/** Next to the theme toggle: Sign in, where sign-in is configured (R94). */
export function SignInButton({ me }: { me: Me | null }) {
  if (!canSignIn(me)) return null;
  return (
    <Link href="/signin" className="btn btn-ghost !px-4 text-sm" data-testid="signin-top">
      Sign in
    </Link>
  );
}

/** Under the header while signed in: who you are, and Sign out (R94). */
export function AccountBar({ me }: { me: Me | null }) {
  if (me?.identity?.kind !== 'user') return null;
  const name = me.identity.name;
  return (
    <div className="flex items-center gap-3" data-testid="account">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-lg font-black text-on-brand" data-testid="account-avatar">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0 flex-1 truncate font-extrabold" data-testid="account-name">
        {name}
      </span>
      <form action={signOutAction}>
        <button className="btn btn-ghost !px-4 text-sm" type="submit" data-testid="sign-out">
          Sign out
        </button>
      </form>
    </div>
  );
}

/** In the Your crews card: why signing in helps (R94). */
export function CrewsSignInPrompt({ me }: { me: Me | null }) {
  if (!canSignIn(me)) return null;
  return (
    <Link href="/signin" className="text-sm font-bold underline" data-testid="crews-signin">
      Sign in to keep your stats on every device
    </Link>
  );
}
