import { expect, test, type Page } from '@playwright/test';
import { closeAll, drawQueue, roomOf, snapshotOf, startGame } from './helpers';

/** Present players pick a word whenever it is their turn to draw. */
function autoChoose(pages: Page[]) {
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      for (const p of pages) {
        if (p.isClosed()) continue;
        const btn = p.getByTestId('draw-choice-0');
        if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  })();
  return async () => {
    stop = true;
    await loop;
  };
}

test('AC-26 an absent drawer is skipped, marked AFK after two misses, keeps score, and plays again after "I\'m back"', async ({ browser }) => {
  test.setTimeout(300_000);
  const { code, players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  const [a, b, c, d] = players;
  await startGame(a.page, drawQueue(4, 5, 0));
  await d.page.close(); // Dev's phone goes dark; nobody touches admin controls.
  const stopAuto = autoChoose([a.page, b.page, c.page]);

  const dev = async () => (await snapshotOf(a.page)).public.seats.find((s: any) => s.name === 'Dev');
  await expect.poll(async () => (await dev()).afk, { timeout: 150_000, intervals: [1000] }).toBe(true);
  expect((await dev()).score).toBe(0);
  const scoreBefore = (await dev()).score;

  // Dev comes back during the next round and taps "I'm back".
  const back = await d.context.newPage();
  await back.goto(`/r/${code}`);
  await expect(back.getByTestId('afk-banner')).toBeVisible({ timeout: 30_000 });
  await back.getByTestId('im-back').click();
  await expect(back.getByTestId('afk-banner')).toHaveCount(0);
  expect((await dev()).score).toBe(scoreBefore);
  // Dev draws again in a later round.
  await expect(back.getByTestId('draw-choices')).toBeVisible({ timeout: 120_000 });
  await stopAuto();
  await closeAll(players);
});
