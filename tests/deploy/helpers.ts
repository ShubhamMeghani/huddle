import { appendFileSync } from 'node:fs';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const TARGET = process.env.DEPLOY_URL ?? 'http://localhost:3000';
export const IS_LOCAL = TARGET.includes('localhost');
/** Production budget is 1 s. A local build in India talking to Neon in US East pays ~1–2 s of DB round trips. */
export const LATENCY_BUDGET_MS = Number(process.env.LATENCY_BUDGET_MS ?? (IS_LOCAL ? 6000 : 1000));

export function record(lines: string[]) {
  appendFileSync('docs/deploy-checks.md', '\n' + lines.join('\n') + '\n');
}

export function p95(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))];
}

export async function openPlayer(browser: Browser, _name?: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: TARGET });
  const page = await context.newPage();
  return { context, page };
}

export async function create(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('create-room').click();
  return (await page.getByTestId('room-code').textContent({ timeout: 30_000 }))!.trim();
}

export async function join(page: Page, code: string, name: string) {
  await page.goto(`/r/${code}`);
  await expect(page.getByTestId('join-screen')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-button').click();
  await expect(page.getByTestId('room')).toBeVisible({ timeout: 30_000 });
}

export async function connection(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __huddleSync?: { state: { connection: string } } }).__huddleSync?.state.connection ?? 'none');
}
