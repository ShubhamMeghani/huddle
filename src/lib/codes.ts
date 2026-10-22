/* Room codes (R5): 4 letters from an alphabet without the easily confused I, L and O. */

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(c) ? c : null;
}
