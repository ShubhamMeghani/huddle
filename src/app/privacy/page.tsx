import Link from 'next/link';

export const metadata = { title: 'Privacy · Huddle' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6" data-testid="privacy">
      <h1 className="text-3xl font-black">Privacy</h1>
      <p className="font-semibold">Huddle is a student course project. It keeps the minimum needed to run game nights.</p>
      <h2 className="text-xl font-black">What we collect</h2>
      <p>The display name you type, a random device token stored in a cookie, and your game results. If you sign in with Google, your Google name, email and picture.</p>
      <h2 className="text-xl font-black">Contact</h2>
      <p>
        Questions or data requests:{' '}
        <a className="font-bold underline" href="https://github.com/ShubhamMeghani/huddle/issues">
          GitHub Issues
        </a>
        .
      </p>
      <Link href="/" className="font-bold underline">
        Back home
      </Link>
    </main>
  );
}
