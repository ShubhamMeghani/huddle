/* Multi-player helpers: each player is its own browser context with the project's device emulation. */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface Player {
  name: string;
  context: BrowserContext;
  page: Page;
}

export function deviceOptions() {
  const use = test.info().project.use as Record<string, unknown>;
  const pick = ['viewport', 'userAgent', 'deviceScaleFactor', 'isMobile', 'hasTouch', 'baseURL', 'locale'];
  return Object.fromEntries(pick.filter((k) => use[k] !== undefined).map((k) => [k, use[k]]));
}

export async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext(deviceOptions());
  const page = await context.newPage();
  return { name, context, page };
}

export async function createRoom(p: Player, seed?: string): Promise<string> {
  if (seed) await p.context.setExtraHTTPHeaders({ 'x-huddle-seed': seed });
  await p.page.goto('/');
  await expect(p.page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await p.page.getByTestId('name-input').fill(p.name);
  await p.page.getByTestId('create-room').click();
  const code = (await p.page.getByTestId('room-code').textContent({ timeout: 20_000 }))!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);
  return code;
}

export async function joinRoom(p: Player, code: string, opts: { spectate?: boolean } = {}) {
  await p.page.goto(`/r/${code}`);
  await expect(p.page.getByTestId('join-screen')).toHaveAttribute('data-ready', 'true');
  await p.page.getByTestId('join-name').fill(p.name);
  await p.page.getByTestId(opts.spectate ? 'watch-button' : 'join-button').click();
  await expect(p.page.getByTestId('room')).toBeVisible({ timeout: 20_000 });
}

/** A room with `names.length` players; the first creates it. */
export async function roomOf(browser: Browser, names: string[], seed?: string): Promise<{ code: string; players: Player[] }> {
  const players = await Promise.all(names.map((n) => newPlayer(browser, n)));
  const code = await createRoom(players[0], seed);
  for (const p of players.slice(1)) await joinRoom(p, code);
  for (const p of players) await expect(p.page.getByTestId('seat')).toHaveCount(names.length);
  return { code, players };
}

export async function closeAll(players: Player[]) {
  await Promise.all(players.map((p) => p.context.close().catch(() => {})));
}

export async function versionOf(page: Page): Promise<number> {
  return Number(await page.getByTestId('room').getAttribute('data-version'));
}
