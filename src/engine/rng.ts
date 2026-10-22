/* Deterministic RNG: the seed and a counter live in room state, so replays and tests are reproducible. */

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Returns an rng bound to a {rngSeed, rngCounter} holder; each call advances the counter. */
export function roomRng(holder: { rngSeed: string; rngCounter: number }): () => number {
  return () => {
    holder.rngCounter += 1;
    return mulberry32(hash32(holder.rngSeed) ^ Math.imul(holder.rngCounter, 0x9e3779b1));
  };
}

export function seededRng(seed: string): () => number {
  const holder = { rngSeed: seed, rngCounter: 0 };
  return roomRng(holder);
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
