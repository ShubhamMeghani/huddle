/* Display names (R1): any script, emoji and words are allowed; only trimming and a 1–24 length limit apply. */

export const NAME_MAX = 24;

export function graphemeLength(s: string): number {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let n = 0;
  for (const part of seg.segment(s)) if (part) n++;
  return n;
}

export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  const len = graphemeLength(name);
  if (len < 1 || len > NAME_MAX) return null;
  return name;
}
