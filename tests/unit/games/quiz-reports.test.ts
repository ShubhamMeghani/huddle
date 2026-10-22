import { expect, test } from 'vitest';
import { excludedQuestionIds, reportQuestion } from '@/server/reports';
import { selectQuestions, BANK } from '@/games/quiz/rules';
import { seededRng } from '@/engine/rng';
import { makeIdentity } from '../../helpers/unit-room';

test('AC-59 duplicate reports are ignored; after 3 distinct reports a question is never selected', async () => {
  const target = BANK.find((q) => q.category === 'science')!.id;
  const [a, b, c] = await Promise.all(['R1', 'R2', 'R3'].map(makeIdentity));
  expect(await reportQuestion(target, a.id, 'wrong_answer')).toBe(true);
  expect(await reportQuestion(target, a.id, 'unclear')).toBe(false); // same player again
  await reportQuestion(target, b.id, 'wrong_answer');
  expect(await excludedQuestionIds()).not.toContain(target);
  await reportQuestion(target, c.id, 'outdated');
  const excluded = new Set(await excludedQuestionIds());
  expect(excluded.has(target)).toBe(true);
  const science = BANK.filter((q) => q.category === 'science');
  for (let i = 0; i < 20; i++) {
    const ids = selectQuestions({ questions: science.length, categories: ['science'], difficulty: 'any' }, new Set(), excluded, seededRng(`s${i}`));
    expect(ids).not.toContain(target);
    expect(ids).toHaveLength(science.length - 1);
  }
});
