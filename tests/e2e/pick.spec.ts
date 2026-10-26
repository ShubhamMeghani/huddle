import { expect, test } from '@playwright/test';
import { closeAll, createRoom, joinRoom, newPlayer } from './helpers';

// Games that need more than two players (Charades and Imposter 4, Most Likely To and Two Truths 3).
const NEEDS_MORE_THAN_TWO = ['charades', 'imposter', 'mlt', 'truths'];

test('AC-93 Pick for us: alone it explains the minimum; with two players it adds fitting games, a different one each time', async ({ browser }) => {
  const a = await newPlayer(browser, 'Asha');
  await createRoom(a);
  await a.page.getByTestId('pick-for-us').click();
  await expect(a.page.getByTestId('pick-message')).toContainText('at least 2 players');
  await expect(a.page.getByTestId('queue-item')).toHaveCount(0);

  const b = await newPlayer(browser, 'Bilal');
  await joinRoom(b, (await a.page.getByTestId('room-code').textContent())!.trim());
  await expect(a.page.getByTestId('seat')).toHaveCount(2);
  for (let n = 1; n <= 3; n++) {
    await a.page.getByTestId('pick-for-us').click();
    await expect(a.page.getByTestId('queue-item')).toHaveCount(n);
    await expect(b.page.getByTestId('queue-item')).toHaveCount(n);
    await expect(a.page.getByTestId('pick-message')).toContainText('fits 2 players');
  }
  const picked = await a.page.getByTestId('queue-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-game')!));
  expect(new Set(picked).size).toBe(3);
  for (const id of picked) expect(NEEDS_MORE_THAN_TWO).not.toContain(id);
  await closeAll([a, b]);
});
