/* Text matching for guesses and places: case, accent, space, hyphen and punctuation insensitive. */

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Draw & Guess near-miss (R72): edit distance 1, or 2 for words of 8+ letters. */
export function isClose(guess: string, word: string): boolean {
  const g = fold(guess);
  const w = fold(word);
  if (!g || g === w) return false;
  return levenshtein(g, w) <= (w.length >= 8 ? 2 : 1);
}
