import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import bank from '../../../content/quiz.json';
import { buildQuiz } from '../../../scripts/build-content';

const CATEGORIES = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

describe('quiz bank (SPEC §4.8)', () => {
  test('AC-56 at least 400 questions and at least 40 per category', () => {
    expect(bank.length).toBeGreaterThanOrEqual(400);
    for (const c of CATEGORIES) expect(bank.filter((q) => q.category === c).length, c).toBeGreaterThanOrEqual(40);
    expect(new Set(bank.map((q) => q.category))).toEqual(new Set(CATEGORIES));
  });

  test('AC-56 unique ids, no duplicate questions, 4 distinct options, answer in range, lengths, difficulty', () => {
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
    expect(new Set(bank.map((q) => norm(q.question))).size).toBe(bank.length);
    for (const q of bank) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options.map(norm)).size, q.id).toBe(4);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.id).toBe(true);
      expect(q.question.length, q.id).toBeLessThanOrEqual(140);
      for (const o of q.options) expect(o.length, `${q.id}: ${o}`).toBeLessThanOrEqual(40);
      expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
    }
  });

  test('AC-56 no time-relative wording that would go stale', () => {
    // "current" in the time sense only (an electric current is fine).
    for (const q of bank) expect(q.question, q.id).not.toMatch(/(?<!electric )\bcurrent\b|\b(currently|latest|this year|right now|recently)\b/i);
  });

  test('quiz.json is exactly what the generator produces from the source', () => {
    const rebuilt = buildQuiz(readFileSync('content/src/quiz.txt', 'utf8'));
    expect(rebuilt).toEqual(bank);
  });
});
