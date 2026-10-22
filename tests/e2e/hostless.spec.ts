import { expect, test } from '@playwright/test';
import { atQuestion, closeAll, quizQueue, roomOf, startGame } from './helpers';

test('AC-33 hostless night: the admin leaves right after starting Quiz → Draw; both games finish and the night summary appears', async ({ browser }) => {
  test.setTimeout(240_000);
  const { players } = await roomOf(browser, ['Admin', 'Bilal', 'Charu', 'Dev']);
  const [a, ...rest] = players;
  await startGame(a.page, [...quizQueue(2, 5), { gameId: 'draw', settings: { rounds: 1, drawSeconds: 5, hints: 0, words: 'mixed' } }]);
  await a.context.close(); // nobody is admin-ing from now on

  for (const q of [1, 2]) {
    for (const p of rest) await atQuestion(p.page, q);
    for (const [i, p] of rest.entries()) await p.page.getByTestId(`quiz-option-${i}`).click();
  }
  for (const p of rest) await expect(p.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  await expect(rest[0].page.getByTestId('next-up')).toContainText('Draw & Guess');

  // Draw & Guess runs on timers; present drawers pick a word when asked.
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (await rest[0].page.getByTestId('night-summary').isVisible().catch(() => false)) break;
    for (const p of rest) {
      const btn = p.page.getByTestId('draw-choice-0');
      if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
    }
    await rest[0].page.waitForTimeout(400);
  }
  for (const p of rest) await expect(p.page.getByTestId('night-summary')).toBeVisible({ timeout: 30_000 });
  for (const p of rest) await expect(p.page.getByTestId('night-game')).toHaveCount(2);
  await closeAll(players);
});
