import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SENTINEL_NEEDLES } from '../helpers/sentinels';
import { closeAll, newPlayer, createRoom, joinRoom } from './helpers';

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

test('AC-6 no secret reaches the browser: static bundles, HTTP responses and realtime frames', async ({ browser }) => {
  const dbUrl = JSON.parse(readFileSync('.cache/e2e-db.json', 'utf8')).url as string;
  const needles = [...SENTINEL_NEEDLES, dbUrl, new URL(dbUrl).password ? `:${new URL(dbUrl).password}@` : dbUrl];

  for (const f of filesUnder('.next/static')) {
    const s = readFileSync(f, 'utf8');
    for (const n of needles) expect(s.includes(n), `${f} contains a secret`).toBe(false);
  }

  const a = await newPlayer(browser, 'Asha');
  const b = await newPlayer(browser, 'Bilal');
  const bodies: string[] = [];
  for (const p of [a, b]) {
    p.page.on('response', async (r) => {
      if (r.url().includes('/api/realtime/stream')) return;
      try {
        bodies.push(await r.text());
      } catch {}
    });
  }
  const code = await createRoom(a);
  await joinRoom(b, code);
  await a.page.getByTestId('wave').click();
  await expect(b.page.getByTestId('wave-count')).toHaveText('1');
  const token = await a.page.request.get(`/api/realtime/token?code=${code}`);
  bodies.push(await token.text());
  const frames = (await b.page.evaluate(() => (window as unknown as { __huddleLog?: string[] }).__huddleLog ?? [])).join('\n');
  expect(frames.length).toBeGreaterThan(0);
  const all = bodies.join('\n') + frames;
  for (const n of needles) expect(all.includes(n)).toBe(false);
  await closeAll([a, b]);
});

test('AC-5 token endpoint: 401 without identity, 403 for a room the identity has not joined', async ({ browser }) => {
  const a = await newPlayer(browser, 'Owner');
  const code = await createRoom(a);
  const stranger = await browser.newContext();
  const r1 = await stranger.request.get(`/api/realtime/token?code=${code}`);
  expect(r1.status()).toBe(401);
  await stranger.request.post('/api/identity/guest', { data: { name: 'Stranger' } });
  const r2 = await stranger.request.get(`/api/realtime/token?code=${code}`);
  expect(r2.status()).toBe(403);
  const r3 = await a.page.request.get(`/api/realtime/token?code=${code}`);
  expect(r3.status()).toBe(200);
  expect(JSON.parse((await r3.json()).capability)).toEqual(expect.objectContaining({}));
  await stranger.close();
  await closeAll([a]);
});
