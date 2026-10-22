import { describe, expect, test } from 'vitest';
import words from '../../../content/draw-words.json';
import drawings from '../../../content/bot-drawings.json';
import { validOps } from '@/lib/strokes';
import { fold } from '@/lib/text';

describe('draw words (SPEC §4.8)', () => {
  test('AC-63 at least 500 words, at least 75 tagged india', () => {
    expect(words.length).toBeGreaterThanOrEqual(500);
    expect(words.filter((w) => w.tags.includes('india')).length).toBeGreaterThanOrEqual(75);
  });

  test('AC-63 unique normalised words; only letters, spaces and hyphens; 3–20 characters; difficulty set', () => {
    expect(new Set(words.map((w) => fold(w.word))).size).toBe(words.length);
    for (const w of words) {
      expect(w.word, w.word).toMatch(/^[a-z][a-z -]*[a-z]$/i);
      expect(w.word.length, w.word).toBeGreaterThanOrEqual(3);
      expect(w.word.length, w.word).toBeLessThanOrEqual(20);
      expect(['easy', 'medium', 'hard']).toContain(w.difficulty);
    }
  });

  test('bot drawings: at least 20, every word exists in the list, ops are valid', () => {
    expect(drawings.length).toBeGreaterThanOrEqual(20);
    const set = new Set(words.map((w) => w.word));
    for (const d of drawings) {
      expect(set.has(d.word), d.word).toBe(true);
      for (const op of d.ops) expect(validOps([op]), d.word).toBe(true);
    }
  });
});
