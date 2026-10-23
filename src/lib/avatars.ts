/* Avatar palette (R91): 12 saturated colours, pairwise distinct, each with a readable text colour. */

export const AVATAR_COLORS = [
  { bg: '#FF4D6D', fg: '#1A0A0F' },
  { bg: '#FF8A00', fg: '#1A0E00' },
  { bg: '#FFC300', fg: '#1A1400' },
  { bg: '#9BD600', fg: '#0F1A00' },
  { bg: '#00B86B', fg: '#00140B' },
  { bg: '#00C2C7', fg: '#001A1B' },
  { bg: '#1E90FF', fg: '#00101F' },
  { bg: '#FFB3C1', fg: '#2A0A12' },
  { bg: '#8A2BE2', fg: '#FFFFFF' },
  { bg: '#E040FB', fg: '#1A001D' },
  { bg: '#8B5A2B', fg: '#FFFFFF' },
  { bg: '#37474F', fg: '#FFFFFF' },
] as const;

export const AVATAR_EMOJIS = [
  '😎', '🦁', '🐯', '🐼', '🦊', '🐸', '🐙', '🦄', '🐝', '🐧', '🦖', '🐬',
  '🍕', '🌶️', '🥭', '🍩', '🎸', '🚀', '⚡', '🔥', '🌈', '🎯', '👑', '🪁',
];

/** First colour index not already used in the room; falls back to round-robin beyond 12. */
export function pickAvatarColor(used: number[]): number {
  for (let i = 0; i < AVATAR_COLORS.length; i++) if (!used.includes(i)) return i;
  return used.length % AVATAR_COLORS.length;
}
