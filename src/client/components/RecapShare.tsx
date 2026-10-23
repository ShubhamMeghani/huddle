'use client';
import { useState } from 'react';

/** Shares the night's recap card (R53) with the Web Share API, or downloads it where sharing files isn't supported. */
export function RecapShare({ roomId }: { roomId: string }) {
  const [busy, setBusy] = useState(false);
  const url = `/api/recap/${roomId}/image`;
  const share = async () => {
    setBusy(true);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const blob = await res.blob();
      const file = new File([blob], 'huddle-recap.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ files: [file], title: 'Huddle recap' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'huddle-recap.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn btn-brand w-full" onClick={share} disabled={busy} data-testid="recap-share">
      📸 Share the recap card
    </button>
  );
}
