import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deviceOptions, openDemo, visitEachGame } from './helpers';

async function contrastViolations(page: Page, where: string) {
  // Measure settled colours, not a card halfway through its pop-in animation.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const nodes = r.violations.flatMap((v) => v.nodes.map((n) => `${where}: ${n.target.join(' ')} (${n.any[0]?.message ?? ''})`));
  return nodes;
}

test('AC-41 light theme by default (even if the OS prefers dark); dark toggle persists; no contrast violations in either theme', async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ ...deviceOptions(), colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lum = await page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g)!.map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });
  expect(lum).toBeGreaterThan(0.8);

  const violations: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') {
      await page.goto('/');
      await page.getByTestId('theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // persists
    }
    await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
    violations.push(...(await contrastViolations(page, `${theme} home`)));
    await openDemo(page);
    violations.push(...(await contrastViolations(page, `${theme} lobby`)));
    await visitEachGame(page, async (id) => {
      await page.waitForTimeout(300);
      violations.push(...(await contrastViolations(page, `${theme} ${id}`)));
    });
    violations.push(...(await contrastViolations(page, `${theme} scoreboard`)));
  }
  expect(violations).toEqual([]);
  await context.close();
});
