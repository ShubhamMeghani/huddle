import { expect, test } from '@playwright/test';
import { closeAll, roomOf, versionOf } from './helpers';

test('AC-16 after 3 dropped realtime messages the phone fetches a snapshot within 1 s and matches the others', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu']);
  const [a, b, c] = players;
  await b.page.evaluate(() => {
    window.__huddleDrop = 3;
  });
  for (let i = 0; i < 4; i++) await a.page.getByTestId('wave').click();
  await expect(a.page.getByTestId('wave-count')).toHaveText('4');
  const t0 = Date.now();
  await expect(b.page.getByTestId('wave-count')).toHaveText('4', { timeout: 3000 });
  expect(Date.now() - t0).toBeLessThan(1500);
  expect(await versionOf(b.page)).toBe(await versionOf(a.page));
  expect(await versionOf(c.page)).toBe(await versionOf(a.page));
  await closeAll(players);
});
