import 'server-only';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import { googleEnabled, isTestMode } from './env';

function providers(): Provider[] {
  const list: Provider[] = [];
  if (googleEnabled()) list.push(Google);
  if (isTestMode()) {
    // Stands in for Google in E2E (SPEC §3 test mode). Never registered on Vercel.
    list.push(
      Credentials({
        id: 'test',
        name: 'Test account',
        credentials: { email: { label: 'Email' }, name: { label: 'Name' } },
        authorize: async (c) => {
          const email = typeof c?.email === 'string' ? c.email : '';
          if (!email) return null;
          return { id: `test:${email}`, email, name: typeof c?.name === 'string' && c.name ? c.name : email.split('@')[0] };
        },
      }),
    );
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: providers(),
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account && user) {
        const { upsertUser } = await import('./identity');
        const sub = account.provider === 'google' ? `google:${account.providerAccountId}` : `test:${user.email}`;
        const ids = await upsertUser({
          sub,
          email: user.email,
          name: user.name ?? (profile?.name as string | undefined),
          image: user.image,
        });
        token.uid = ids.userId;
        token.identityId = ids.identityId;
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as { identityId?: string }).identityId = token.identityId as string | undefined;
      return session;
    },
  },
}));
