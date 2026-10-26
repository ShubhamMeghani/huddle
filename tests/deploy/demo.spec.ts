import { expect, test } from '@playwright/test';
import { record, TARGET, IS_LOCAL } from './helpers';

test('AC-87 a fresh browser follows the home-page link to /demo and finishes a Quiz against bots in under 2 minutes', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: TARGET }); // no cookies
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto('/');
  await page.getByTestId('demo-link').click();
  await expect(page.getByTestId('demo-start')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('demo-go').click();
  await page.getByTestId('demo-quiz').click({ timeout: 30_000 });
  while (!(await page.getByTestId('break').isVisible().catch(() => false))) {
    const intro = page.getByTestId('intro-skip'); // the How-to-play card before the first question (R95)
    if ((await intro.isVisible().catch(() => false)) && (await intro.isEnabled().catch(() => false))) await intro.click({ timeout: 2_000 }).catch(() => {});
    const opt = page.getByTestId('quiz-option-0');
    // Short click: the option can vanish between the check and the tap when the question ends.
    if ((await opt.isVisible().catch(() => false)) && (await opt.isEnabled().catch(() => false))) await opt.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (Date.now() - t0 > 120_000) break;
  }
  const ms = Date.now() - t0;
  await expect(page.getByTestId('break')).toBeVisible();
  record([`### AC-87 demo · ${new Date().toISOString()} · ${IS_LOCAL ? 'local production build' : TARGET}`, '', `- /demo → Quiz against 4 bots finished in ${Math.round(ms / 1000)} s ✔`]);
  expect(ms).toBeLessThan(120_000);
  await context.close();
});
