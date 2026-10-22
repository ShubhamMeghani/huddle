import { expect, test } from '@playwright/test';
import { connection, create, join, LATENCY_BUDGET_MS, openPlayer, p95, record, TARGET, IS_LOCAL } from './helpers';

test('AC-77 Ably token auth works and updates arrive within budget; test-mode surfaces are off', async ({ browser }) => {
  const a = await openPlayer(browser, 'Asha');
  const b = await openPlayer(browser, 'Bilal');
  const code = await create(a.page, 'Asha');
  await join(b.page, code, 'Bilal');

  // Token: subscribe-only capability for this room's channel.
  const tr = await b.page.request.get(`/api/realtime/token?code=${code}`);
  expect(tr.status()).toBe(200);
  const cap = JSON.parse((await tr.json()).capability);
  expect(Object.values(cap)).toEqual([['subscribe']]);
  await expect.poll(() => connection(b.page), { timeout: 20_000 }).toBe('live');

  // 50 actions from A; time until B renders each.
  const lat: number[] = [];
  for (let i = 1; i <= 50; i++) {
    const t0 = Date.now();
    await a.page.getByTestId('wave').click();
    await expect(b.page.getByTestId('wave-count')).toHaveText(String(i), { timeout: 15_000 });
    lat.push(Date.now() - t0);
  }
  const p = p95(lat);

  // Test-mode surfaces must be absent on a real deployment.
  const stream = await a.page.request.get(`/api/realtime/stream?code=${code}`);
  expect(stream.status()).toBe(404);
  await a.page.goto('/signin');
  await expect(a.page.getByTestId('test-signin')).toHaveCount(0);

  record([
    `### AC-77 realtime · ${new Date().toISOString()} · ${IS_LOCAL ? 'local production build + real Ably + Neon dev' : TARGET}`,
    '',
    `- Token: subscribe-only capability ✔; connection live via Ably ✔; test-mode routes off ✔`,
    `- Action → other phone update over 50 actions: p50 ${lat.slice().sort((x, y) => x - y)[25]} ms, p95 ${p} ms (budget ${LATENCY_BUDGET_MS} ms)`,
  ]);
  expect(p).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
  await a.context.close();
  await b.context.close();
});
