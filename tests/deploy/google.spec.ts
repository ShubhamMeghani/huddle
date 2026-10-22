import { expect, test } from '@playwright/test';
import { record, TARGET } from './helpers';

test('AC-79 Google sign-in redirects to Google with the right client and callback, without an error page', async ({ page, request }) => {
  const me = await (await request.get(`${TARGET}/api/identity/me`)).json();
  test.skip(!me.google, 'Pending (human): Google OAuth is not configured on this deployment (H5)');
  await page.goto(`${TARGET}/signin`);
  await page.getByTestId('google-signin').click();
  await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 });
  const url = new URL(page.url());
  const inner = url.searchParams.get('redirect_uri') ?? decodeURIComponent(url.toString()).match(/redirect_uri=([^&]+)/)?.[1] ?? '';
  expect(inner).toBe(`${TARGET}/api/auth/callback/google`);
  const body = await page.content();
  for (const bad of ['redirect_uri_mismatch', 'invalid_client', 'Access blocked']) expect(body).not.toContain(bad);
  record([`### AC-79 Google redirect · ${new Date().toISOString()} · ${TARGET}`, '', `- Redirect to Google with callback ${inner} and no error page ✔`]);
});
