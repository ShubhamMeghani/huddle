import { expect, test } from '@playwright/test';
import { closeAll, createRoom, joinRoom, newPlayer, startGame } from './helpers';

test('AC-23 two phones with clocks 60 s apart show the same countdown within 1 s', async ({ browser }) => {
  const a = await newPlayer(browser, 'Ahead');
  const b = await newPlayer(browser, 'Behind');
  await a.page.clock.setSystemTime(Date.now() + 60_000);
  await b.page.clock.setSystemTime(Date.now() - 60_000);
  const code = await createRoom(a);
  await joinRoom(b, code);
  await startGame(a.page, [{ gameId: 'ping', settings: { mode: 'all', rounds: 1, turnSeconds: 40 } }]);
  for (let i = 0; i < 3; i++) {
    const [sa, sb] = await Promise.all([
      a.page.getByTestId('countdown').getAttribute('data-seconds'),
      b.page.getByTestId('countdown').getAttribute('data-seconds'),
    ]);
    expect(Math.abs(Number(sa) - Number(sb))).toBeLessThanOrEqual(1);
    expect(Number(sa)).toBeGreaterThan(20);
    await a.page.waitForTimeout(700);
  }
  await closeAll([a, b]);
});
