import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { apiPlayer, closeAll, createRoom, newPlayer } from './helpers';

test('AC-8 code, link and QR; joining by link and by typed code; unknown code shows Room not found', async ({ browser }) => {
  const a = await newPlayer(browser, 'Aarav');
  const code = await createRoom(a);
  await expect(a.page.getByTestId('lobby-code')).toHaveText(code);
  const link = await a.page.getByTestId('room-link').inputValue();
  expect(link).toMatch(new RegExp(`/r/${code}$`));
  const png = PNG.sync.read(Buffer.from(await (await a.page.request.get(`/api/rooms/${code}/qr`)).body()));
  expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(link);

  const b = await newPlayer(browser, 'Bela');
  await b.page.goto(link);
  await expect(b.page.getByTestId('join-code-value')).toHaveText(code);

  const c = await newPlayer(browser, 'Chetan');
  await c.page.goto('/');
  await expect(c.page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await c.page.getByTestId('code-input').fill(code.toLowerCase());
  await c.page.getByTestId('join-code').click();
  await expect(c.page.getByTestId('join-code-value')).toHaveText(code);

  await c.page.goto('/r/ZZZZ');
  await expect(c.page.getByTestId('room-not-found')).toBeVisible();
  await expect(c.page.getByTestId('create-instead')).toBeVisible();
  await closeAll([a, b, c]);
});

test('AC-9 with 12 seated players a 13th is offered only Watch and the seat count stays 12', async ({ browser }) => {
  const a = await newPlayer(browser, 'Host');
  const code = await createRoom(a);
  const extras = [];
  for (let i = 2; i <= 12; i++) extras.push(await apiPlayer(browser, code, `P${i}`));
  await expect(a.page.getByTestId('seat')).toHaveCount(12);
  const late = await newPlayer(browser, 'Thirteen');
  await late.page.goto(`/r/${code}`);
  await expect(late.page.getByTestId('room-full')).toBeVisible();
  await expect(late.page.getByTestId('join-button')).toHaveCount(0);
  await late.page.getByTestId('join-name').fill('Thirteen');
  await late.page.getByTestId('watch-button').click();
  await expect(late.page.getByTestId('spectator-banner')).toBeVisible();
  await expect(a.page.getByTestId('seat')).toHaveCount(12);
  await expect(a.page.getByTestId('spectators')).toContainText('Thirteen');
  await Promise.all(extras.map((e) => e.ctx.close()));
  await closeAll([a, late]);
});
