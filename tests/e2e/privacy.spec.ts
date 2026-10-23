import { expect, test } from '@playwright/test';

test('AC-86 /privacy loads without sign-in, is linked from home and the sign-in prompt, and covers what, why, who, how long, contact and no ads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByTestId('privacy')).toBeVisible();
  for (const heading of ['What we collect', 'Why', 'Who processes it', 'How long we keep it', 'Contact']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId('privacy-contact-link')).toHaveAttribute('href', 'https://github.com/ShubhamMeghani/huddle/issues');
  await expect(page.getByTestId('privacy')).toContainText(/no ads and no trackers/i);
  for (const processor of ['Vercel', 'Neon', 'Ably', 'Google']) await expect(page.getByTestId('privacy-processors')).toContainText(processor);

  await page.goto('/signin');
  await page.getByRole('link', { name: 'privacy page' }).click();
  await expect(page.getByTestId('privacy')).toBeVisible();
});
