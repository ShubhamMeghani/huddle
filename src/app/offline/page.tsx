export const metadata = { title: 'Offline · Huddle' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center" data-testid="offline">
      <div className="text-6xl" aria-hidden>
        📡
      </div>
      <h1 className="text-3xl font-black">You’re offline</h1>
      <p className="font-semibold text-muted">Huddle needs the internet to keep everyone in sync. Your seat and score are safe. Reconnect and reload to jump back in.</p>
      {/* A full page load (not client-side navigation) is what we want when coming back online. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn btn-brand">
        Try again
      </a>
    </main>
  );
}
