import { expect, test } from '@playwright/test';

test('AC-44 installable PWA: manifest, icons, Apple meta, an active service worker, and an offline screen', async ({ page, context }) => {
  await page.goto('/');
  const href = await page.getAttribute('link[rel=manifest]', 'href');
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest.name).toContain('Huddle');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const i of manifest.icons) expect((await page.request.get(i.src)).ok()).toBe(true);

  await expect(page.locator('link[rel=apple-touch-icon][sizes="180x180"]')).toHaveCount(1);
  await expect(page.locator('meta[name=apple-mobile-web-app-capable][content=yes]')).toHaveCount(1);
  await expect(page.locator('meta[name=apple-mobile-web-app-title][content=Huddle]')).toHaveCount(1);

  const active = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  });
  expect(active).toBe(true);
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto('/r/ABCD').catch(() => {});
  await expect(page.getByTestId('offline')).toBeVisible();
  await context.setOffline(false);
});
