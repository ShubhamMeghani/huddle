import { expect, test, type Page } from '@playwright/test';
import { closeAll, joinRoom, newPlayer, quizQueue, snapshotOf, startGame } from './helpers';

async function testSignIn(page: Page, email: string, name: string) {
  await page.goto('/signin');
  await page.getByTestId('test-email').fill(email);
  await page.getByTestId('test-name').fill(name);
  await page.getByTestId('test-signin').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'));
}

test('AC-3 a signed-in user gets the same seat and score on another device; the first device is told', async ({ browser }) => {
  const email = `u${Date.now()}${Math.floor(Math.random() * 1e6)}@example.test`;
  const a = await newPlayer(browser, 'Priya');
  await testSignIn(a.page, email, 'Priya');
  await a.page.goto('/');
  await expect(a.page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await expect(a.page.getByTestId('name-input')).toHaveValue('Priya');
  await a.page.getByTestId('create-room').click();
  const code = (await a.page.getByTestId('room-code').textContent())!.trim();
  const seatId = await a.page.getByTestId('seat').first().getAttribute('data-seat-id');
  // U and a guest play a one-question quiz; U's score must follow U to the other device.
  const g = await newPlayer(browser, 'Guest');
  await joinRoom(g, code);
  await startGame(a.page, quizQueue(1, 30));
  await a.page.getByTestId('quiz-option-0').click();
  await g.page.getByTestId('quiz-option-1').click();
  await expect(a.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  const scoreA = await a.page.locator(`[data-testid=standing][data-seat-id=${seatId}]`).getByTestId('standing-score').textContent();

  const b = await newPlayer(browser, 'Priya');
  await testSignIn(b.page, email, 'Priya');
  await b.page.goto(`/r/${code}`);
  await expect(b.page.getByTestId('room')).toBeVisible();
  await expect(b.page.getByTestId('join-screen')).toHaveCount(0);
  // The break may already be over on B; the finished game's recorded score is in the snapshot either way.
  const rowB = (await snapshotOf(b.page)).public.lastGame.rows.find((r: { seatId: string }) => r.seatId === seatId);
  expect(String(rowB.score)).toBe(scoreA!.trim());
  expect((await snapshotOf(b.page)).me.seatId).toBe(seatId);
  await expect(a.page.getByTestId('seat-moved')).toBeVisible();
  await closeAll([a, b, g]);
});
