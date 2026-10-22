import { chromium, expect, firefox, test, webkit, type Browser, type Page } from '@playwright/test';
import { create, join, record, TARGET, IS_LOCAL } from './helpers';

test('@skeleton six real browsers (2 Chromium, 2 Firefox, 2 WebKit) in one room converge after 30 actions and a reload', async () => {
  const launchers = [chromium, chromium, firefox, firefox, webkit, webkit];
  const browsers: Browser[] = await Promise.all(launchers.map((l) => l.launch()));
  const pages: Page[] = [];
  for (const b of browsers) pages.push(await (await b.newContext({ baseURL: TARGET })).newPage());
  const code = await create(pages[0], 'P1');
  for (let i = 1; i < 6; i++) await join(pages[i], code, `P${i + 1}`);
  for (const p of pages) await expect(p.getByTestId('seat')).toHaveCount(6, { timeout: 30_000 });

  const t0 = Date.now();
  const clicks: Promise<void>[] = [];
  for (let round = 0; round < 5; round++) {
    for (const p of pages) clicks.push(p.getByTestId('wave').click());
    if (round === 2) await pages[3].reload(); // one Firefox phone reloads mid-run
  }
  await Promise.all(clicks.map((c) => c.catch(() => {})));
  // A click racing the reload may be lost; top up so exactly 30 actions are accepted.
  await expect.poll(async () => Number(await pages[0].getByTestId('wave-count').textContent()), { timeout: 30_000 }).toBeGreaterThanOrEqual(29);
  const n = Number(await pages[0].getByTestId('wave-count').textContent());
  for (let i = n; i < 30; i++) await pages[0].getByTestId('wave').click();
  for (const p of pages) await expect(p.getByTestId('wave-count')).toHaveText('30', { timeout: 30_000 });
  const versions = await Promise.all(pages.map((p) => p.getByTestId('room').getAttribute('data-version')));
  expect(new Set(versions).size).toBe(1);
  record([
    `### Six-browser check (@skeleton) · ${new Date().toISOString()} · ${IS_LOCAL ? 'local production build + real Ably + Neon dev' : TARGET}`,
    '',
    `- 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-run: all show 30 waves and version ${versions[0]} ✔ (converged in ${Date.now() - t0} ms)`,
  ]);
  await Promise.all(browsers.map((b) => b.close()));
});
