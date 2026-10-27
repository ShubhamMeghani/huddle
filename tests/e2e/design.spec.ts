import { expect, test } from '@playwright/test';
import { apiPlayer, closeAll, newPlayer, createRoom, openDemo, visitEachGame, joinRoom, startGame } from './helpers';

const ACCENTS: Record<string, string> = { quiz: '#1d4ed8', draw: '#ffc400', imposter: '#7c3aed', atlas: '#0b7a45', charades: '#ff2e88', mlt: '#ff7a00', npat: '#0891b2' };

test('AC-84 each game has its own accent colour on its main phase', async ({ page }) => {
  test.setTimeout(180_000);
  await openDemo(page);
  const seen = new Set<string>();
  await visitEachGame(page, async (id) => {
    const accent = await page.getByTestId('playing').evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim().toLowerCase());
    expect(accent, id).toBe(ACCENTS[id]);
    seen.add(accent);
  });
  expect(seen.size).toBe(Object.keys(ACCENTS).length);
});

test('AC-84 a 12-player lobby has unique avatar colours and emoji; a player can change their emoji; avatars appear on the scoreboard and turn indicator', async ({ browser }) => {
  const a = await newPlayer(browser, 'Asha');
  const code = await createRoom(a);
  const extras = [];
  for (let i = 2; i <= 12; i++) extras.push(await apiPlayer(browser, code, `P${i}`));
  await expect(a.page.getByTestId('seat')).toHaveCount(12);
  const colors = await a.page.locator('[data-testid=seat] [data-testid=avatar]').evaluateAll((els) => els.map((e) => e.getAttribute('data-avatar-color')));
  const emojis = await a.page.locator('[data-testid=seat] [data-testid=avatar]').evaluateAll((els) => els.map((e) => e.textContent));
  expect(new Set(colors).size).toBe(12);
  expect(new Set(emojis).size).toBe(12);

  await a.page.getByTestId('my-avatar').click();
  await a.page.getByTestId('emoji-21').click(); // 🎯
  await expect(a.page.locator('[data-testid=seat]', { hasText: '(you)' }).getByTestId('avatar')).toHaveText('🎯');
  await Promise.all(extras.map((e) => e.ctx.close()));

  // Turn indicator and scoreboard show avatars too.
  const b = await newPlayer(browser, 'Bilal');
  const code2 = await createRoom(b);
  const c = await newPlayer(browser, 'Charu');
  await joinRoom(c, code2);
  await startGame(b.page, [{ gameId: 'ping', settings: { mode: 'turns', rounds: 1, turnSeconds: 30 } }]);
  await expect(c.page.getByTestId('turn-status').locator('..').getByTestId('avatar')).toBeVisible();
  await b.page.getByTestId('admin-open').click();
  await b.page.getByTestId('admin-end-game').click();
  await expect(b.page.getByTestId('standing').first().getByTestId('avatar')).toBeVisible();
  await closeAll([a, b, c]);
});
