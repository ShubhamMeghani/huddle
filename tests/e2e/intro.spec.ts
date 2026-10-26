import { expect, test } from '@playwright/test';
import { act, closeAll, quizQueue, roomOf } from './helpers';

test('AC-91 a How-to-play card with three lines and an example comes before the first round, waits for everyone’s Got it, and never shows again in that room', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  // Test mode starts with the cards off; the admin switches them on in the lobby.
  await expect(a.page.getByTestId('intro-toggle')).not.toBeChecked();
  await a.page.getByTestId('intro-toggle').check();
  await expect(a.page.getByTestId('intro-toggle')).toBeChecked();
  expect((await act(a.page, 'setQueue', { queue: quizQueue(2, 20) })).ok).toBe(true);
  await a.page.getByTestId('start').click();

  for (const p of players) {
    const card = p.page.getByTestId('intro-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('How to play Quiz Clash');
    await expect(p.page.getByTestId('intro-lines').locator('li')).toHaveCount(3);
    await expect(p.page.getByTestId('intro-example')).toContainText('Example');
    await expect(p.page.getByTestId('quiz-question')).toHaveCount(0);
  }
  await a.page.getByTestId('intro-skip').click();
  await expect(a.page.getByTestId('intro-skip')).toBeDisabled();
  await expect(b.page.getByTestId('intro-ready-count')).toContainText('1/2 ready');
  await expect(b.page.getByTestId('intro-card')).toBeVisible();
  await b.page.getByTestId('intro-skip').click();
  for (const p of players) await expect(p.page.getByTestId('quiz-question')).toBeVisible();

  // A rematch of the same game goes straight to the first question.
  expect((await act(a.page, 'endGame')).ok).toBe(true);
  await expect(a.page.getByTestId('break')).toBeVisible();
  expect((await act(a.page, 'rematch')).ok).toBe(true);
  for (const p of players) {
    await expect(p.page.getByTestId('quiz-question')).toBeVisible();
    await expect(p.page.getByTestId('intro-card')).toHaveCount(0);
  }
  await closeAll(players);
});
