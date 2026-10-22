import { expect, test } from '@playwright/test';
import { closeAll, newPlayer, roomOf } from './helpers';

test('AC-21 a fresh device claims a disconnected seat; the admin approves; the old device is told', async ({ browser }) => {
  const { code, players } = await roomOf(browser, ['Admin', 'Meera']);
  const [a, m] = players;
  await m.page.getByTestId('wave').click();
  const seatId = await m.page.locator('[data-testid=seat]', { hasText: '(you)' }).getAttribute('data-seat-id');
  // Meera's phone goes dark (page closed but context kept, so the old token still exists).
  const oldPage = m.page;
  await oldPage.close();
  await a.page.waitForTimeout(5_000); // presence window in test mode is 4 s

  const fresh = await newPlayer(browser, 'Meera');
  await fresh.page.goto(`/r/${code}`);
  await fresh.page.getByTestId('join-name').fill('Meera');
  await fresh.page.locator(`[data-testid=claim-seat][data-seat-id=${seatId}]`).click();
  await expect(fresh.page.getByTestId('claim-pending')).toBeVisible();
  await a.page.getByTestId('approve-claim').click();
  await expect(fresh.page.getByTestId('room')).toBeVisible({ timeout: 20_000 });
  await expect(fresh.page.locator('[data-testid=seat]', { hasText: '(you)' })).toHaveAttribute('data-seat-id', seatId!);
  await expect(fresh.page.getByTestId('wave-count')).toHaveText('1');

  const back = await m.context.newPage();
  await back.goto(`/r/${code}`);
  await expect(back.getByTestId('join-screen')).toBeVisible();
  await closeAll([a, m, fresh]);
});
