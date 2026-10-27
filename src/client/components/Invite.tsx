'use client';
import { useState } from 'react';

/** The invite text shared to WhatsApp (R98). */
export function inviteText(code: string, link: string): string {
  return `Join my Huddle game night! Room ${code}: ${link}`;
}

/** Lobby invite (R98): a big Share on WhatsApp button, a large QR code and the code itself. */
export function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/r/${code}` : `/r/${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <section className="card flex flex-col items-center gap-3 p-4 text-center" aria-label="Invite friends">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted">Invite friends · room code</div>
      <div className="text-4xl font-black tracking-[0.25em]" data-testid="lobby-code">
        {code}
      </div>
      <a
        className="btn btn-whatsapp w-full text-lg"
        href={`https://wa.me/?text=${encodeURIComponent(inviteText(code, link))}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="share-whatsapp"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4 5.1 5.1 0 0 0 3.1.6 2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
        </svg>
        Share on WhatsApp
      </a>
      <img
        src={`/api/rooms/${code}/qr`}
        alt={`QR code to join room ${code}`}
        width={240}
        height={240}
        className="h-60 w-60 rounded-2xl bg-white"
        data-testid="room-qr"
      />
      <p className="text-sm font-semibold text-muted">Friends in the room can scan this with their phone camera.</p>
      <button className="btn btn-ghost w-full" onClick={copy} data-testid="copy-link">
        {copied ? 'Copied!' : '🔗 Copy link'}
      </button>
      <input className="sr-only" readOnly value={link} aria-label="Join link" data-testid="room-link" />
    </section>
  );
}
