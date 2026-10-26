import { expect, test } from '@playwright/test';
import { chooseWord, closeAll, drawLine, drawQueue, findDrawer, opDigest, roomOf, startGame } from './helpers';

test('AC-17 mid-turn reload and closed-tab reopen restore seat, score, timer and the full drawing', async ({ browser }) => {
  test.setTimeout(120_000);
  const { code, players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  await startGame(players[0].page, drawQueue(1, 90));
  const drawer = await findDrawer(players);
  const [b, c] = players.filter((p) => p !== drawer);
  await chooseWord(drawer.page);
  await drawLine(drawer.page, [100, 100], [900, 650]);
  await drawLine(drawer.page, [900, 100], [100, 650]);
  await drawer.page.waitForTimeout(400);
  const seatB = await b.page.evaluate(() => (window as any).__huddleSync.state.snapshot.me.seatId);
  const seatC = await c.page.evaluate(() => (window as any).__huddleSync.state.snapshot.me.seatId);

  // B reloads.
  await b.page.reload();
  await expect(b.page.getByTestId('draw-canvas')).toBeVisible();
  // C closes the tab and comes back 20 s later.
  await c.page.close();
  await drawer.page.waitForTimeout(20_000);
  await drawLine(drawer.page, [500, 100], [500, 650]); // drawn while C was away
  await drawer.page.waitForTimeout(400);
  const cPage = await c.context.newPage();
  await cPage.goto(`/r/${code}`);
  await expect(cPage.getByTestId('draw-canvas')).toBeVisible();

  const want = await opDigest(drawer.page);
  await expect.poll(() => opDigest(b.page), { timeout: 3000 }).toBe(want);
  await expect.poll(() => opDigest(cPage), { timeout: 3000 }).toBe(want);
  expect(await b.page.evaluate(() => (window as any).__huddleSync.state.snapshot.me.seatId)).toBe(seatB);
  expect(await cPage.evaluate(() => (window as any).__huddleSync.state.snapshot.me.seatId)).toBe(seatC);
  const secs = await Promise.all([drawer.page, b.page, cPage].map((p) => p.getByTestId('countdown').getAttribute('data-seconds')));
  expect(Math.max(...secs.map(Number)) - Math.min(...secs.map(Number))).toBeLessThanOrEqual(1);
  await closeAll(players);
});
