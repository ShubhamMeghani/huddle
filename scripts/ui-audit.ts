/* UI audit: full-page screenshots of every main screen and game phase at phone and desktop width, light and dark.
 * Usage: start the test-mode server (E2E_PORT=3197 npx tsx scripts/e2e-server.ts), then
 *        npx tsx scripts/ui-audit.ts <outDir> [baseURL]. Not part of the test suite. */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'ui-audit';
const BASE = process.argv[3] ?? 'http://localhost:3197';
const GAMES = ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt'] as const;
const VIEWPORTS = {
  phone: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
} as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const act = (page: Page, type: string, payload: Record<string, unknown> = {}) =>
  page.evaluate(([t, p]) => (window as any).__huddleSync.act(t, p), [type, payload] as const);

async function main() {
  const browser = await chromium.launch();
  for (const [vp, opts] of Object.entries(VIEWPORTS)) {
    for (const theme of ['light', 'dark'] as const) {
      const dir = join(OUT, `${vp}-${theme}`);
      mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({ ...opts, baseURL: BASE, reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => localStorage.setItem('huddle-theme', t), theme);
      const page = await ctx.newPage();
      const shot = async (name: string) => {
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
        await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
      };

      await page.goto('/');
      await page.getByTestId('home').and(page.locator('[data-ready=true]')).waitFor();
      await shot('01-home');
      await page.goto('/signin');
      await shot('02-signin');
      await page.goto('/privacy');
      await shot('03-privacy');

      // A normal room lobby (settings, QR, seats).
      await page.goto('/');
      await page.getByTestId('home').and(page.locator('[data-ready=true]')).waitFor();
      await page.getByTestId('name-input').fill('Asha');
      await page.getByTestId('create-room').click();
      await page.getByTestId('room-code').waitFor();
      await wait(800);
      await shot('04-lobby');

      // Demo room with bots: every game.
      await page.goto('/demo');
      await page.locator('[data-testid=demo-start][data-ready=true]').waitFor();
      await shot('05-demo-start');
      await page.getByTestId('demo-go').click();
      await page.getByTestId('demo-picker').waitFor();
      await wait(800);
      await shot('06-demo-lobby');
      let n = 7;
      for (const id of GAMES) {
        await page.getByTestId(`demo-${id}`).click();
        await page.locator(`[data-testid=playing][data-game=${id}]`).waitFor();
        await wait(1500);
        await shot(`${String(n++).padStart(2, '0')}-${id}-main`);
        if (id === 'quiz') {
          await page.getByTestId('quiz-option-0').click().catch(() => {});
          await page.getByTestId('quiz-reveal').waitFor({ timeout: 20_000 }).catch(() => {});
          await shot(`${String(n++).padStart(2, '0')}-quiz-reveal`);
        }
        if (id === 'draw') {
          await wait(5000);
          await shot(`${String(n++).padStart(2, '0')}-draw-later`);
        }
        if (id === 'mlt') {
          await page.getByTestId('mlt-vote-for').first().click().catch(() => {});
          await page.getByTestId('mlt-reveal').waitFor({ timeout: 20_000 }).catch(() => {});
          await shot(`${String(n++).padStart(2, '0')}-mlt-reveal`);
        }
        await wait(1200);
        await act(page, 'endGame');
        await page.getByTestId('break').waitFor({ timeout: 20_000 }).catch(() => {});
        if (id === 'quiz') {
          await wait(800);
          await shot(`${String(n++).padStart(2, '0')}-break-scoreboard`);
        }
        await wait(1200);
      }
      await act(page, 'endNight');
      await page.getByTestId('night-summary').waitFor({ timeout: 20_000 }).catch(() => {});
      await wait(800);
      await shot(`${String(n++).padStart(2, '0')}-night-summary`);

      if (vp === 'desktop') {
        const code = (await page.getByTestId('room-code').textContent())!.trim();
        const tv = await ctx.newPage();
        await tv.goto('/screen');
        await tv.getByTestId('screen-code').fill(code);
        await tv.getByTestId('screen-go').click();
        await wait(2500);
        await tv.screenshot({ path: join(dir, `${String(n++).padStart(2, '0')}-big-screen.png`) });
        await tv.close();
      }
      await ctx.close();
      console.log('done', vp, theme);
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
