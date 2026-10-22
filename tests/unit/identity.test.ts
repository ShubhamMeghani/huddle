import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeName } from '@/lib/names';

describe('display names', () => {
  test('AC-1 accepts any 1–24 character name in any script, with emoji and rude words; rejects empty and 25+', () => {
    expect(normalizeName('Ravi')).toBe('Ravi');
    expect(normalizeName('रवि')).toBe('रवि');
    expect(normalizeName('😎 Bunty')).toBe('😎 Bunty');
    expect(normalizeName('BC Bhai')).toBe('BC Bhai');
    expect(normalizeName('  Meera  ')).toBe('Meera');
    expect(normalizeName('a'.repeat(24))).toBe('a'.repeat(24));
    expect(normalizeName('👨‍👩‍👧‍👦'.repeat(24))).not.toBeNull(); // 24 graphemes
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('a'.repeat(25))).toBeNull();
    expect(normalizeName(42)).toBeNull();
  });

  test('AC-1 the codebase contains no word filter', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk('src');
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/profan|badword|bad-words|blocklist|censor/i);
    }
  });
});
