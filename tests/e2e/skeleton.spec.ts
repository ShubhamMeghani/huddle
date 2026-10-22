import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { closeAll, roomOf, versionOf } from './helpers';

test('@skeleton three phones share live updates, survive a reload and recover from dropped messages', async ({ browser }) => {
  const { code, players } = await roomOf(browser, ['Aarav', 'Diya', 'Kabir']);
  const [a, b, c] = players;

  // Live updates through the full pipeline.
  await a.page.getByTestId('wave').click();
  await b.page.getByTestId('wave').click();
  await c.page.getByTestId('wave').click();
  for (const p of players) await expect(p.page.getByTestId('wave-count')).toHaveText('3');

  // Reload restores the same seat and state.
  const seat = await c.page.locator('[data-testid=seat]', { hasText: '(you)' }).getAttribute('data-seat-id');
  await c.page.reload();
  await expect(c.page.getByTestId('wave-count')).toHaveText('3');
  await expect(c.page.locator('[data-testid=seat]', { hasText: '(you)' })).toHaveAttribute('data-seat-id', seat!);

  // Dropped realtime messages: the version gap triggers a snapshot.
  await b.page.evaluate(() => {
    window.__huddleDrop = 2;
  });
  await a.page.getByTestId('wave').click();
  await a.page.getByTestId('wave').click();
  await a.page.getByTestId('wave').click();
  await expect(b.page.getByTestId('wave-count')).toHaveText('6');
  expect(await versionOf(b.page)).toBe(await versionOf(a.page));

  // The QR encodes the join link.
  const qr = await a.page.request.get(`/api/rooms/${code}/qr`);
  const png = PNG.sync.read(Buffer.from(await qr.body()));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toMatch(new RegExp(`/r/${code}$`));
  await closeAll(players);
});
