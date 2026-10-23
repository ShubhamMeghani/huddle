import { expect, test, type Page } from '@playwright/test';
import { deviceOptions, openDemo, visitEachGame } from './helpers';

async function checkLayout(page: Page, where: string) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(r.sw, `${where}: horizontal scroll`).toBeLessThanOrEqual(r.w);
  const small = await page.$$eval('.btn-brand, .btn-primary', (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width < 47.5 || b.height < 47.5)
      .map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`),
  );
  expect(small, `${where}: primary buttons under 48 px`).toEqual([]);
}

test('AC-40 every main screen fits the phone width with 48 px primary buttons, iOS-safe viewport and safe-area padding', async ({ browser }) => {
  test.setTimeout(240_000);
  // 360 × 740 on the Android project; the iPhone project keeps its own iPhone viewport.
  const opts = deviceOptions() as Record<string, unknown>;
  const narrow = test.info().project.name === 'android' ? { ...opts, viewport: { width: 360, height: 740 } } : opts;
  const context = await browser.newContext(narrow);
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await checkLayout(page, 'home');
  const meta = await page.getAttribute('meta[name=viewport]', 'content');
  expect(meta).toContain('viewport-fit=cover');
  const css = (await Promise.all((await page.$$eval('link[rel=stylesheet]', (ls) => ls.map((l) => (l as HTMLLinkElement).href))).map((h) => page.request.get(h).then((r) => r.text())))).join('\n');
  expect(css).toContain('env(safe-area-inset-top)');
  expect(css).toMatch(/100dvh/);
  expect(css).not.toMatch(/(?<![\d.])100vh/);

  await openDemo(page);
  await checkLayout(page, 'lobby');
  await visitEachGame(page, async (id) => {
    await checkLayout(page, `${id} main phase`);
    await page.getByTestId('leaderboard-open').click();
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await checkLayout(page, `${id} leaderboard overlay`);
    await page.getByTestId('leaderboard-close').click();
  });
  await checkLayout(page, 'scoreboard');

  // Crew page.
  await page.goto('/');
  await page.getByTestId('crew-new').click();
  await page.getByTestId('crew-name').fill('Layout Crew');
  await page.getByTestId('crew-create').click();
  await expect(page.getByTestId('crew-page')).toBeVisible();
  await checkLayout(page, 'crew page');
  await context.close();
});
