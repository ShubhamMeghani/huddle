import { expect, test, type Page } from '@playwright/test';
import { closeAll, newPlayer } from './helpers';

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
  await a.page.getByTestId('wave').click();
  await expect(a.page.getByTestId('wave-count')).toHaveText('1');

  const b = await newPlayer(browser, 'Priya');
  await testSignIn(b.page, email, 'Priya');
  await b.page.goto(`/r/${code}`);
  await expect(b.page.getByTestId('room')).toBeVisible();
  await expect(b.page.getByTestId('join-screen')).toHaveCount(0);
  const mine = b.page.locator('[data-testid=seat]', { hasText: '(you)' });
  await expect(mine).toHaveAttribute('data-seat-id', seatId!);
  await expect(b.page.getByTestId('seat')).toHaveCount(1);
  await expect(a.page.getByTestId('seat-moved')).toBeVisible();
  await closeAll([a, b]);
});
