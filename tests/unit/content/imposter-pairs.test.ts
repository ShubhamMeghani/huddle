import { expect, test } from 'vitest';
import pairs from '../../../content/imposter-pairs.json';
import { fold } from '@/lib/text';
import { validClue } from '@/games/imposter/rules';

test('AC-71 at least 150 pairs; unordered pairs unique; a ≠ b; two valid hints per word', () => {
  expect(pairs.length).toBeGreaterThanOrEqual(150);
  const keys = pairs.map((p) => [fold(p.a), fold(p.b)].sort().join('|'));
  expect(new Set(keys).size).toBe(pairs.length);
  expect(new Set(pairs.map((p) => p.id)).size).toBe(pairs.length);
  for (const p of pairs) {
    expect(fold(p.a), p.id).not.toBe(fold(p.b));
    expect(p.hintsA, p.id).toHaveLength(2);
    expect(p.hintsB, p.id).toHaveLength(2);
    for (const h of p.hintsA) expect(validClue(h, p.a), `${p.id}: ${h}`).toBe(true);
    for (const h of p.hintsB) expect(validClue(h, p.b), `${p.id}: ${h}`).toBe(true);
  }
});
