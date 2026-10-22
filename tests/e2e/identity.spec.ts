import { expect, test } from '@playwright/test';
import { closeAll, createRoom, newPlayer } from './helpers';

test('AC-2 a guest joins with a name; httpOnly device cookie; reload keeps the same seat', async ({ browser }) => {
  const p = await newPlayer(browser, '😎 Bunty');
  const code = await createRoom(p);
  const cookie = (await p.context.cookies()).find((c) => c.name === 'huddle_dt');
  expect(cookie?.httpOnly).toBe(true);
  const seatBefore = await p.page.getByTestId('seat').first().getAttribute('data-seat-id');
  await p.page.reload();
  await expect(p.page.getByTestId('room')).toBeVisible();
  await expect(p.page.getByTestId('join-screen')).toHaveCount(0);
  expect(await p.page.getByTestId('seat').first().getAttribute('data-seat-id')).toBe(seatBefore);
  await expect(p.page.getByTestId('seat').first()).toContainText('😎 Bunty');
  expect(code).toMatch(/^[A-Z]{4}$/);
  await closeAll([p]);
});
