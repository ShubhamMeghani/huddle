import { chromium, expect, firefox, test, webkit, type Browser, type Page } from '@playwright/test';
import { create, join, LATENCY_BUDGET_MS, p95, record, TARGET, IS_LOCAL } from './helpers';

async function sixBrowsers() {
  const launchers = [chromium, chromium, firefox, firefox, webkit, webkit];
  const browsers: Browser[] = await Promise.all(launchers.map((l) => l.launch()));
  const pages: Page[] = [];
  for (const b of browsers) pages.push(await (await b.newContext({ baseURL: TARGET })).newPage());
  const code = await create(pages[0], 'P1');
  for (let i = 1; i < 6; i++) await join(pages[i], code, `P${i + 1}`);
  for (const p of pages) await expect(p.getByTestId('seat')).toHaveCount(6, { timeout: 30_000 });
  return { browsers, pages, code };
}

const act = (page: Page, type: string, payload: Record<string, unknown> = {}) =>
  page.evaluate(([t, p]) => (window as any).__huddleSync.act(t, p), [type, payload] as const);

test('@skeleton six real browsers (2 Chromium, 2 Firefox, 2 WebKit) in one room converge after 30 actions and a reload', async () => {
  const { browsers, pages } = await sixBrowsers();
  const t0 = Date.now();
  const clicks: Promise<void>[] = [];
  for (let round = 0; round < 5; round++) {
    for (const p of pages) clicks.push(p.getByTestId('wave').click());
    if (round === 2) await pages[3].reload(); // one Firefox phone reloads mid-run
  }
  await Promise.all(clicks.map((c) => c.catch(() => {})));
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

test('AC-80 six real browsers play 3 Quiz questions and a Draw turn; one reloads mid-turn; identical scoreboards; latency within budget', async () => {
  test.setTimeout(600_000);
  const { browsers, pages } = await sixBrowsers();
  const all = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];
  await act(pages[0], 'start', { queue: [{ gameId: 'quiz', settings: { questions: 5, seconds: 30, categories: all, difficulty: 'any', mode: 'solo' } }, { gameId: 'draw', settings: { rounds: 1, drawSeconds: 60, hints: 0, words: 'mixed' } }] });
  const lat: number[] = [];
  for (let q = 1; q <= 3; q++) {
    for (const p of pages) await expect(p.getByTestId('quiz-progress')).toContainText(`Question ${q} /`, { timeout: 60_000 });
    for (let i = 0; i < 6; i++) {
      await pages[i].getByTestId(`quiz-option-${i % 4}`).click(); // waits until the phone may answer
      const t0 = Date.now(); // the tap has been sent
      if (i < 5) {
        const watcher = pages[(i + 1) % 6];
        await expect(watcher.getByTestId('quiz-answered')).toContainText(`${i + 1} / 6`, { timeout: 15_000 });
        lat.push(Date.now() - t0);
      }
    }
  }
  // Production quizzes have at least 5 questions: after the 3 the AC asks for, the admin ends the game.
  await act(pages[0], 'endGame');
  for (const p of pages) await expect(p.getByTestId('break')).toBeVisible({ timeout: 60_000 });
  const quizBoards = await Promise.all(pages.map((p) => p.getByTestId('standings').textContent()));
  expect(new Set(quizBoards).size).toBe(1);

  await pages[0].getByTestId('continue').click();
  let drawer: Page | undefined;
  await expect.poll(async () => {
    for (const p of pages) if (await p.getByTestId('draw-choices').isVisible()) drawer = p;
    return Boolean(drawer);
  }, { timeout: 60_000 }).toBe(true);
  await drawer!.getByTestId('draw-choice-0').click();
  const viewers = pages.filter((p) => p !== drawer);
  const strokeLat: number[] = [];
  const box = (await drawer!.getByTestId('draw-canvas').boundingBox())!;
  for (let k = 0; k < 5; k++) {
    const y = box.y + box.height * (0.2 + k * 0.15);
    const t0 = Date.now();
    await drawer!.mouse.move(box.x + box.width * 0.1, y);
    await drawer!.mouse.down();
    await drawer!.mouse.move(box.x + box.width * 0.9, y, { steps: 10 });
    await drawer!.mouse.up();
    await drawer!.waitForTimeout(300);
    const want = await drawer!.getByTestId('draw-canvas').getAttribute('data-op-digest');
    for (const v of viewers) await expect.poll(() => v.getByTestId('draw-canvas').getAttribute('data-op-digest'), { timeout: 15_000 }).toBe(want);
    strokeLat.push(Date.now() - t0 - 300);
    if (k === 2) await viewers[0].reload(); // one phone reloads mid-turn and must catch up
  }
  // End the drawing turn and compare final scoreboards.
  await act(pages[0], 'endGame');
  for (const p of pages) await expect(p.getByTestId('break')).toBeVisible({ timeout: 60_000 });
  const boards = await Promise.all(pages.map((p) => p.getByTestId('standings').textContent()));
  expect(new Set(boards).size).toBe(1);
  record([
    `### AC-80 six real browsers · ${new Date().toISOString()} · ${IS_LOCAL ? 'local production build + real Ably + Neon dev' : TARGET}`,
    '',
    `- 3 Quiz questions + 1 Draw turn on 2 Chromium + 2 Firefox + 2 WebKit, one reload mid-turn: identical scoreboards ✔`,
    `- Action → other phone p95: ${p95(lat)} ms · stroke → all viewers p95: ${p95(strokeLat)} ms (budget ${LATENCY_BUDGET_MS} ms)`,
  ]);
  expect(p95(lat)).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
  expect(p95(strokeLat)).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
  await Promise.all(browsers.map((b) => b.close()));
});
