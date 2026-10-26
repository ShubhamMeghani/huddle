import { expect, test } from '@playwright/test';
import { chooseWord, closeAll, drawLine, drawQueue, findDrawer, opDigest, roomOf, startGame } from './helpers';

// Regression (production AC-80, 2026-10-26): stroke batches published while a viewer's realtime was attaching or down
// were never delivered, and with no later batch there was no gap to notice. A snapshot taken mid-turn must catch up
// the strokes too (SPEC §4.2), so a viewer that reloads mid-turn with realtime blocked still follows the drawing.
test('AC-66 a viewer that reloads mid-turn with realtime blocked gets every stroke through snapshot catch-up', async ({ browser }) => {
  test.setTimeout(120_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  await startGame(players[0].page, drawQueue(1, 90, 0));
  const drawer = await findDrawer(players);
  const viewer = players.find((p) => p !== drawer)!;
  await chooseWord(drawer.page);
  await drawLine(drawer.page, [100, 100], [900, 650]);

  // The viewer comes back mid-turn with no realtime at all: only snapshots (polled every 3 s) reach it.
  await viewer.context.route('**/api/realtime/stream**', (route) => route.abort());
  await viewer.context.addInitScript(() => localStorage.setItem('huddle-test-no-realtime', '1')); // WebKit ignores routes for EventSource
  await viewer.page.reload();
  await expect(viewer.page.getByTestId('draw-canvas')).toBeVisible();
  await drawLine(drawer.page, [900, 100], [100, 650]); // the last strokes of the turn: no later batch reveals a gap
  await drawLine(drawer.page, [500, 100], [500, 650]);
  await drawer.page.waitForTimeout(400);

  const want = await opDigest(drawer.page);
  // R16 polls every 3 s once realtime has been down for 10 s, so the first catch-up lands 13–16 s after the reload.
  await expect.poll(() => opDigest(viewer.page), { timeout: 20_000 }).toBe(want);
  await expect(viewer.page.getByTestId('reconnecting')).toBeVisible(); // it really was polling
  await closeAll(players);
});
