import Link from 'next/link';

export const metadata = { title: 'Privacy · Huddle' };

const ISSUES = 'https://github.com/ShubhamMeghani/huddle/issues';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="card flex flex-col gap-2 p-5" data-testid={`privacy-${id}`}>
      <h2 id={id} className="text-xl font-black">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Privacy page (R93): what we collect, why, who processes it, how long we keep it, and how to reach us. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6" data-testid="privacy">
      <h1 className="text-3xl font-black">Privacy</h1>
      <p className="font-semibold">
        Huddle is a student course project for playing party games with friends. It keeps only what it needs to run your game nights. There are{' '}
        <strong>no ads and no trackers</strong>: no analytics, no advertising cookies, and nothing is sold or shared for marketing.
      </p>

      <Section id="collect" title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>The display name you type (it can be anything, including a nickname).</li>
          <li>A random device token, kept in a cookie, so your seat and score come back if your phone drops out.</li>
          <li>If you choose to sign in with Google: your Google account name, email address and profile picture.</li>
          <li>Game results: scores, ranks and simple game stats (like quiz answer times), and the crews you join.</li>
          <li>Question reports you send, and places voted in or out in Atlas.</li>
        </ul>
      </Section>

      <Section id="why" title="Why">
        <p>
          To run the games, keep everyone’s phones in sync, restore your seat when you rejoin, balance teams, and show crew leaderboards, stats,
          history and awards. Sign-in is optional and only lets your profile follow you to other devices.
        </p>
      </Section>

      <Section id="processors" title="Who processes it">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Vercel</strong> hosts the website and its server functions.
          </li>
          <li>
            <strong>Neon</strong> stores the database (rooms, results, crews).
          </li>
          <li>
            <strong>Ably</strong> delivers live game updates to your phone. It only ever carries public game information, never secrets or your email.
          </li>
          <li>
            <strong>Google</strong> handles sign-in, only if you choose to use it.
          </li>
        </ul>
      </Section>

      <Section id="retention" title="How long we keep it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Live rooms expire 24 hours after their last activity; drawings and connection records are then deleted.</li>
          <li>Game results, ratings and crew history are kept so your season stats work, until you ask us to delete them.</li>
          <li>The device cookie lasts up to a year; a big-screen cookie lasts 24 hours. You can clear them in your browser at any time.</li>
        </ul>
      </Section>

      <Section id="choices" title="Your choices">
        <p>You can always play as a guest without an account, sign out at any time, and ask us to delete your data.</p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Questions or data requests (access or deletion): open an issue on{' '}
          <a className="font-bold underline" href={ISSUES} data-testid="privacy-contact-link">
            GitHub Issues
          </a>
          . Please don’t post private details publicly. Ask for a private follow-up and we will arrange one.
        </p>
      </Section>

      <div className="flex gap-4 font-bold">
        <Link href="/" className="underline">
          Back home
        </Link>
        <Link href="/about" className="underline">
          About
        </Link>
      </div>
    </main>
  );
}
