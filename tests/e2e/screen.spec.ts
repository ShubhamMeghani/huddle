import { expect, test } from '@playwright/test';
import { closeAll, drawLine, drawQueue, findDrawer, opDigest, roomOf, startGame } from './helpers';

test('AC-55 a big screen joins by code, is not a player, shows the lobby QR, the live drawing, timer and leaderboard, resyncs, and never sees the word', async ({ browser }) => {
  const { code, players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu']);
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const screen = await tv.newPage();
  const bodies: string[] = [];
  screen.on('response', async (r) => {
    if (r.url().includes('/api/realtime/stream')) return;
    // Room data arrives in documents and API responses. Static bundles are the same for every room (AC-6 scans them
    // for secrets) and contain words like "queue" as plain code, which would match a random Draw word.
    if (!['document', 'fetch', 'xhr'].includes(r.request().resourceType())) return;
    try {
      bodies.push(await r.text());
    } catch {}
  });
  await screen.goto('/screen');
  await screen.getByTestId('screen-code').fill(code.toLowerCase());
  await screen.getByTestId('screen-go').click();
  await expect(screen.getByTestId('screen-lobby')).toBeVisible();
  await expect(screen.getByTestId('screen-qr')).toBeVisible();
  await expect(screen.getByTestId('lb-row')).toHaveCount(3);
  await expect(players[0].page.getByTestId('seat')).toHaveCount(3); // the screen is not a player

  await startGame(players[0].page, drawQueue(1, 60, 0));
  const drawer = await findDrawer(players);
  await drawer.page.getByTestId('draw-choice-0').click();
  const word = (await drawer.page.getByTestId('draw-word').textContent())!.trim();
  await expect(screen.getByTestId('screen-sidebar')).toBeVisible();
  await expect(screen.getByTestId('countdown')).toBeVisible();
  await drawLine(drawer.page, [100, 100], [700, 500]);
  await drawer.page.waitForTimeout(400);
  const want = await opDigest(drawer.page);
  await expect.poll(() => opDigest(screen), { timeout: 3000 }).toBe(want);

  await screen.reload();
  await expect.poll(() => opDigest(screen), { timeout: 3000 }).toBe(want);
  await expect(screen.getByTestId('lb-row')).toHaveCount(3);

  const frames = await screen.evaluate(() => ((window as unknown as { __huddleLog?: string[] }).__huddleLog ?? []).join('\n'));
  const seen = (bodies.join('\n') + frames).toLowerCase();
  expect(seen).not.toContain(`"${word.toLowerCase()}"`);
  await tv.close();
  await closeAll(players);
});
