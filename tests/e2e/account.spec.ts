import { expect, test } from '@playwright/test';

test('AC-89 Sign in is offered at the top and in Your crews; signed in shows name, avatar and Sign out; Sign out brings both prompts back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('signin-top')).toBeVisible();
  await expect(page.getByTestId('crews-signin')).toHaveText('Sign in to keep your stats on every device');
  await expect(page.getByTestId('crews-signin')).toHaveAttribute('href', '/signin');
  await expect(page.getByTestId('account')).toHaveCount(0);

  await page.getByTestId('signin-top').click();
  await page.waitForURL('**/signin');
  await page.getByTestId('test-email').fill(`acct${Date.now()}${Math.floor(Math.random() * 1e6)}@example.test`);
  await page.getByTestId('test-name').fill('Meera');
  await page.getByTestId('test-signin').click();
  await page.waitForURL((u) => u.pathname === '/');

  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('account-name')).toHaveText('Meera');
  await expect(page.getByTestId('account-avatar')).toHaveText('M');
  await expect(page.getByTestId('signin-top')).toHaveCount(0);
  await expect(page.getByTestId('crews-signin')).toHaveCount(0);
  // The account bar fits the phone width (AC-40).
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);

  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('account')).toHaveCount(0);
  await expect(page.getByTestId('signin-top')).toBeVisible();
  await expect(page.getByTestId('crews-signin')).toBeVisible();
});
