import { expect, test } from '@playwright/test';
import { closeAll, createRoom, joinRoom, newPlayer } from './helpers';

test('AC-96 the lobby has a big Share on WhatsApp button with the invite and link, and a large QR code', async ({ browser }) => {
  const a = await newPlayer(browser, 'Asha');
  const code = await createRoom(a);
  const link = await a.page.getByTestId('room-link').inputValue();
  const share = a.page.getByTestId('share-whatsapp');
  await expect(share).toBeVisible();
  const href = (await share.getAttribute('href'))!;
  expect(href.startsWith('https://wa.me/?text=')).toBe(true);
  const text = decodeURIComponent(href.slice('https://wa.me/?text='.length));
  expect(text).toContain(code);
  expect(text).toContain(link);
  const viewport = a.page.viewportSize()!;
  const btn = (await share.boundingBox())!;
  expect(btn.height).toBeGreaterThanOrEqual(48);
  expect(btn.width).toBeGreaterThanOrEqual(viewport.width * 0.7);
  const qr = (await a.page.getByTestId('room-qr').boundingBox())!;
  expect(qr.width).toBeGreaterThanOrEqual(220);
  expect(await a.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await closeAll([a]);
});

test('AC-96 a phone remembers its player’s name: joining another room is one tap, even after its guest cookie is gone', async ({ browser }) => {
  const a = await newPlayer(browser, 'Asha');
  const b = await newPlayer(browser, 'Bilal');
  const code1 = await createRoom(a);
  await joinRoom(b, code1);

  // A second room: Bilal's phone already knows the name, so one tap joins.
  await a.page.goto('/');
  const code2 = await createRoom(a);
  await b.page.goto(`/r/${code2}`);
  await expect(b.page.getByTestId('join-name')).toHaveValue('Bilal');
  await b.page.getByTestId('join-button').click();
  await expect(b.page.getByTestId('room')).toBeVisible();
  await expect(a.page.getByTestId('seat')).toHaveCount(2);

  // Without any server identity (cookies cleared), the name still comes from this phone.
  await b.context.clearCookies();
  await a.page.goto('/');
  const code3 = await createRoom(a);
  await b.page.goto(`/r/${code3}`);
  await expect(b.page.getByTestId('join-button')).toHaveText('Join as Bilal');
  await b.page.getByTestId('join-button').click();
  await expect(b.page.getByTestId('room')).toBeVisible();
  await expect(a.page.getByTestId('seat').filter({ hasText: 'Bilal' })).toHaveCount(1);
  await b.page.goto('/');
  await expect(b.page.getByTestId('name-input')).toHaveValue('Bilal');
  await closeAll([a, b]);
});
