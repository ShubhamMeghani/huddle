import { expect, test } from '@playwright/test';
import { atQuestion, closeAll, createRoom, joinRoom, newPlayer, quizQueue, roomOf, startGame } from './helpers';

test('AC-19 a phone offline for 15 s mid-quiz shows Reconnecting, then resyncs and keeps playing with its score', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  await startGame(a.page, quizQueue(2, 30));
  await atQuestion(b.page, 1);
  await b.page.getByTestId('quiz-option-0').click();
  await b.context.setOffline(true);
  await expect(b.page.getByTestId('reconnecting')).toBeVisible({ timeout: 5_000 });
  await a.page.getByTestId('quiz-option-1').click(); // question 1 ends while B is offline
  await atQuestion(a.page, 2);
  await b.page.waitForTimeout(15_000 - 3_000);
  await b.context.setOffline(false);
  await atQuestion(b.page, 2);
  await expect(b.page.getByTestId('reconnecting')).toHaveCount(0, { timeout: 10_000 });
  await b.page.getByTestId('quiz-option-2').click();
  await expect(b.page.getByTestId('quiz-answered')).toContainText('Locked in');
  await a.page.getByTestId('quiz-option-3').click();
  for (const p of players) await expect(p.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  // B's question-1 answer (given before going offline) still counts: both phones show identical standings.
  const boardA = await a.page.getByTestId('standing').evaluateAll((els) => els.map((e) => e.textContent).join('|'));
  await expect.poll(() => b.page.getByTestId('standing').evaluateAll((els) => els.map((e) => e.textContent).join('|'))).toBe(boardA);
  await closeAll(players);
});

test('AC-20 with realtime blocked entirely, a phone follows a 3-question quiz by polling and answers every question', async ({ browser }) => {
  const a = await newPlayer(browser, 'Asha');
  const b = await newPlayer(browser, 'Blocked');
  await b.context.route('**/api/realtime/stream**', (route) => route.abort());
  await b.context.addInitScript(() => localStorage.setItem('huddle-test-no-realtime', '1')); // WebKit ignores routes for EventSource
  const code = await createRoom(a);
  await joinRoom(b, code);
  await startGame(a.page, quizQueue(3, 25));
  for (let q = 1; q <= 3; q++) {
    await atQuestion(b.page, q);
    await b.page.getByTestId(`quiz-option-${q % 4}`).click();
    await expect(b.page.getByTestId('quiz-answered')).toContainText('Locked in');
    await a.page.getByTestId(`quiz-option-${(q + 1) % 4}`).click();
  }
  await expect(b.page.getByTestId('reconnecting')).toBeVisible();
  for (const p of [a, b]) await expect(p.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  const boardA = await a.page.getByTestId('standing').evaluateAll((els) => els.map((e) => e.textContent).join('|'));
  await expect.poll(() => b.page.getByTestId('standing').evaluateAll((els) => els.map((e) => e.textContent).join('|'))).toBe(boardA);
  await closeAll([a, b]);
});
