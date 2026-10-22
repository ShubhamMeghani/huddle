import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { create, openPlayer, record, TARGET, IS_LOCAL } from './helpers';

const FILE = '.cache/neon-check.json';

test('AC-78 @before-restart room state is written to Postgres', async ({ browser }) => {
  const a = await openPlayer(browser, 'Neha');
  const code = await create(a.page, 'Neha');
  await a.page.getByTestId('wave').click();
  await a.page.getByTestId('wave').click();
  await expect(a.page.getByTestId('wave-count')).toHaveText('2');
  const state = await a.context.storageState();
  mkdirSync('.cache', { recursive: true });
  writeFileSync(FILE, JSON.stringify({ code, state }));
  await a.context.close();
});

test('AC-78 @after-restart the same room and seat survive a server restart or redeploy', async ({ browser }) => {
  const { code, state } = JSON.parse(readFileSync(FILE, 'utf8'));
  const context = await browser.newContext({ baseURL: TARGET, storageState: state });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(`/r/${code}`);
  await expect(page.getByTestId('wave-count')).toHaveText('2', { timeout: 30_000 });
  const ms = Date.now() - t0;
  await expect(page.locator('[data-testid=seat]', { hasText: '(you)' })).toBeVisible();
  record([
    `### AC-78 Postgres persistence · ${new Date().toISOString()} · ${IS_LOCAL ? 'local production build + Neon dev (server restarted)' : TARGET}`,
    '',
    `- Room ${code} state and seat restored after restart ✔ (first load ${ms} ms)`,
  ]);
  await context.close();
});
