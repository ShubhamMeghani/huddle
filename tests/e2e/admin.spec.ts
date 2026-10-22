import { expect, test } from '@playwright/test';
import { act, closeAll, roomOf, startGame } from './helpers';

const pingTurns = (turnSeconds = 30) => [{ gameId: 'ping', settings: { mode: 'turns', rounds: 3, turnSeconds } }];

test('AC-12 a kicked player sees "Removed by the admin", cannot rejoin, and others get a notice', async ({ browser }) => {
  const { code, players } = await roomOf(browser, ['Admin', 'Bina', 'Dev']);
  const [a, b, d] = players;
  await a.page.getByTestId('admin-open').click();
  await a.page.locator('[data-testid=admin-player]', { hasText: 'Dev' }).getByTestId('kick').click();
  await expect(d.page.getByTestId('kicked')).toBeVisible();
  await expect(b.page.getByTestId('notice')).toContainText('Dev was removed');
  const r = await d.page.request.post(`/api/rooms/${code}/join`, { data: {} });
  expect(r.status()).toBe(403);
  expect((await r.json()).code).toBe('KICKED');
  await expect(a.page.getByTestId('seat')).toHaveCount(2);
  await closeAll(players);
});

test('AC-29 pause/resume, skip, end game and transfer admin with notices; non-admins get NOT_ADMIN', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Admin', 'Bina', 'Chirag']);
  const [a, b, c] = players;
  await startGame(a.page, pingTurns());
  for (const p of players) await expect(p.page.getByTestId('turn-status')).toBeVisible();

  // Pause: every phone shows the overlay and a frozen timer.
  await a.page.getByTestId('admin-open').click();
  await a.page.getByTestId('admin-pause').click();
  for (const p of players) await expect(p.page.getByTestId('paused')).toBeVisible();
  const frozen = await b.page.getByTestId('countdown').getAttribute('data-seconds');
  await b.page.waitForTimeout(2200);
  expect(await b.page.getByTestId('countdown').getAttribute('data-seconds')).toBe(frozen);
  await expect(c.page.getByTestId('notice')).toContainText('paused');
  expect((await act(b.page, 'resume')).code).toBe('NOT_ADMIN');

  await a.page.getByTestId('admin-open').click();
  await a.page.getByTestId('admin-resume').click();
  for (const p of players) await expect(p.page.getByTestId('paused')).toHaveCount(0);

  // Skip the current (admin's) turn.
  await expect(b.page.getByTestId('turn-status')).toContainText('Waiting for Admin');
  await a.page.getByTestId('admin-open').click();
  await a.page.getByTestId('admin-skip').click();
  await expect(b.page.getByTestId('turn-status')).toHaveText('Your turn');
  await expect(c.page.getByTestId('notice')).toContainText('skipped');

  // End the game: scoreboard on every phone.
  await a.page.getByTestId('admin-open').click();
  await a.page.getByTestId('admin-end-game').click();
  for (const p of players) await expect(p.page.getByTestId('break')).toBeVisible();

  // Transfer admin.
  await a.page.getByTestId('admin-open').click();
  await a.page.locator('[data-testid=admin-player]', { hasText: 'Bina' }).getByTestId('make-admin').click();
  await expect(c.page.getByTestId('notice')).toContainText('Bina is now admin');
  await expect(b.page.getByTestId('admin-open')).toBeVisible();
  await expect(a.page.getByTestId('admin-open')).toHaveCount(0);
  await closeAll(players);
});

test('AC-31 when the admin closes their page, the longest-present connected player becomes admin', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Admin', 'Bina', 'Chirag']);
  const [a, b, c] = players;
  await a.context.close();
  await expect(b.page.getByTestId('admin-open')).toBeVisible({ timeout: 30_000 });
  await expect(c.page.getByTestId('admin-open')).toHaveCount(0);
  await expect(c.page.locator('[data-testid=seat]', { hasText: 'Bina' })).toContainText('ADMIN');
  await closeAll([b, c]);
});
