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

/**
 * WebKit shares one network process (and its 6-connections-per-host limit) across contexts, and each phone in a
 * room holds an open event stream in test mode, so a 7th phone could never load and the 6th could not send. Real phones
 * are separate devices: every phone after the first 4 gets its own browser, leaving connections free for requests.
 */
const PHONES_PER_BROWSER = 4;
const extraBrowsers = new WeakMap<BrowserContext, Browser>();

async function browserFor(browser: Browser, index: number): Promise<Browser> {
  if (index < PHONES_PER_BROWSER) return browser;
  return browser.browserType().launch();
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
  await p.page.goto(`/r/${code}`, { waitUntil: 'domcontentloaded' });
  await expect(p.page.getByTestId('join-screen')).toHaveAttribute('data-ready', 'true');
  await p.page.getByTestId('join-name').fill(p.name);
  await p.page.getByTestId(opts.spectate ? 'watch-button' : 'join-button').click();
  await expect(p.page.getByTestId('room')).toBeVisible({ timeout: 20_000 });
}

/** A room with `names.length` players; the first creates it. */
export async function roomOf(browser: Browser, names: string[], seed?: string): Promise<{ code: string; players: Player[] }> {
  const players = await Promise.all(names.map(async (n, i) => {
    const b = await browserFor(browser, i);
    const p = await newPlayer(b, n);
    if (b !== browser) extraBrowsers.set(p.context, b);
    return p;
  }));
  const code = await createRoom(players[0], seed);
  for (const p of players.slice(1)) await joinRoom(p, code);
  for (const p of players) await expect(p.page.getByTestId('seat')).toHaveCount(names.length);
  return { code, players };
}

export async function closeAll(players: Player[]) {
  await Promise.all(players.map(async (p) => {
    await p.context.close().catch(() => {});
    await extraBrowsers.get(p.context)?.close().catch(() => {});
  }));
}

export async function versionOf(page: Page): Promise<number> {
  return Number(await page.getByTestId('room').getAttribute('data-version'));
}

/** Sends an action through the page's own sync client (same path as a button tap). */
export async function act(page: Page, type: string, payload: Record<string, unknown> = {}) {
  // After a reload the sync client starts asynchronously: wait until it has its first snapshot.
  await page.waitForFunction(() => Boolean((window as unknown as { __huddleSync?: { state: { snapshot: unknown } } }).__huddleSync?.state.snapshot));
  return page.evaluate(
    ([t, p]) => (window as unknown as { __huddleSync: { act: (a: string, b: unknown) => Promise<any> } }).__huddleSync.act(t as string, p),
    [type, payload] as const,
  );
}

export async function startGame(admin: Page, queue: { gameId: string; settings: Record<string, unknown> }[]) {
  const r1 = await act(admin, 'setQueue', { queue });
  expect(r1.ok, JSON.stringify(r1)).toBe(true);
  await admin.getByTestId('start').click();
  await expect(admin.getByTestId('playing')).toBeVisible();
}

/** Adds players through the API only (no browser), for bulk seats. */
export async function apiPlayer(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ baseURL: (test.info().project.use as { baseURL?: string }).baseURL });
  const g = await ctx.request.post('/api/identity/guest', { data: { name } });
  expect(g.ok()).toBe(true);
  const j = await ctx.request.post(`/api/rooms/${code}/join`, { data: {} });
  return { ctx, join: await j.json() };
}

export const ALL_QUIZ = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];

export function quizQueue(questions: number, seconds: number, extra: Record<string, unknown> = {}) {
  return [{ gameId: 'quiz', settings: { questions, seconds, categories: ALL_QUIZ, difficulty: 'any', mode: 'solo', ...extra } }];
}

/** Waits until the page shows question number n (1-based). */
export async function atQuestion(page: Page, n: number) {
  await expect(page.getByTestId('quiz-progress')).toContainText(`Question ${n} /`, { timeout: 30_000 });
}

export function drawQueue(rounds: number, drawSeconds: number, hints = 2) {
  return [{ gameId: 'draw', settings: { rounds, drawSeconds, hints, words: 'mixed' } }];
}

/** Drags across the canvas with the mouse (logical 0–1000 × 0–750 coordinates). */
export async function drawLine(page: Page, from: [number, number], to: [number, number], steps = 12) {
  const box = (await page.getByTestId('draw-canvas').boundingBox())!;
  const at = (p: [number, number]) => [box.x + (p[0] / 1000) * box.width, box.y + (p[1] / 750) * box.height] as const;
  const [x1, y1] = at(from);
  const [x2, y2] = at(to);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps });
  await page.mouse.up();
}

/** The player whose phone shows the word choices. */
export async function findDrawer(players: Player[]): Promise<Player> {
  for (let i = 0; i < 100; i++) {
    for (const p of players) if (await p.page.getByTestId('draw-choices').isVisible().catch(() => false)) return p;
    await players[0].page.waitForTimeout(200);
  }
  throw new Error('no drawer found');
}

export async function opDigest(page: Page): Promise<string | null> {
  return page.getByTestId('draw-canvas').getAttribute('data-op-digest');
}

export function snapshotOf(page: Page): Promise<any> {
  return page.evaluate(() => (window as unknown as { __huddleSync: { state: { snapshot: unknown } } }).__huddleSync.state.snapshot);
}

/** Opens a fresh demo room in `page` (visitor is admin, 4 bots). */
export async function openDemo(page: Page) {
  await page.goto('/demo');
  await expect(page.getByTestId('demo-start')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('demo-go').click();
  await expect(page.getByTestId('demo-picker')).toBeVisible();
}

export const GAME_IDS = ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt'] as const;

/** In a demo room: start `id`, run `check` on its main phase, then end it as admin and return to a scoreboard. */
export async function visitEachGame(page: Page, check: (id: (typeof GAME_IDS)[number]) => Promise<void>) {
  for (const id of GAME_IDS) {
    await page.getByTestId(`demo-${id}`).click();
    await expect(page.getByTestId('playing')).toHaveAttribute('data-game', id);
    await check(id);
    await page.getByTestId('admin-open').click();
    await page.getByTestId('admin-end-game').click();
    await expect(page.getByTestId('break')).toBeVisible();
  }
}

/** Plays along on one phone: does whatever the phone asks until `untilTestId` appears. */
export async function playUntil(page: Page, untilTestId: string, timeoutMs = 600_000) {
  const tap = async (id: string) => {
    const el = page.getByTestId(id).first();
    if ((await el.isVisible().catch(() => false)) && (await el.isEnabled().catch(() => false))) {
      await el.click({ timeout: 2000 }).catch(() => {});
      return true;
    }
    return false;
  };
  const fill = async (id: string, text: string, send: string) => {
    const el = page.getByTestId(id);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(text, { timeout: 2000 }).catch(() => {});
      await tap(send);
    }
  };
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (page.isClosed()) throw new Error('page closed');
    if (await page.getByTestId(untilTestId).isVisible().catch(() => false)) return;
    await tap('quiz-option-0');
    if (await tap('draw-choice-0')) await drawLine(page, [200, 200], [700, 500]).catch(() => {});
    await tap('charades-guessed');
    await tap('steal-none');
    await fill('clue-input', 'mystery', 'clue-send');
    await tap('imposter-ready');
    await tap('vote-for');
    await fill('guess-word-input', 'pizza', 'guess-word-send');
    await tap('mlt-vote-for');
    await tap('atlas-accept');
    await page.waitForTimeout(400);
  }
  throw new Error(`did not reach ${untilTestId}`);
}
