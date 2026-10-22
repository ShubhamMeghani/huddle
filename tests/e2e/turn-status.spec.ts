import { expect, test } from '@playwright/test';
import { closeAll, createRoom, joinRoom, newPlayer, startGame } from './helpers';

test('AC-43 "Your turn" vs "Waiting for <name>", one gentle vibration, silent where unsupported, never any audio', async ({ browser }) => {
  const a = await newPlayer(browser, 'Anu');
  const b = await newPlayer(browser, 'Babu');
  // A: vibration supported and recorded. B: vibration missing (as on iOS). Both: audio creation recorded.
  await a.context.addInitScript(() => {
    (window as any).__vibes = [];
    Object.defineProperty(navigator, 'vibrate', { value: (ms: number) => ((window as any).__vibes.push(ms), true), configurable: true });
  });
  await b.context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    } catch {}
  });
  for (const p of [a, b]) {
    await p.context.addInitScript(() => {
      (window as any).__audio = 0;
      const Orig = (window as any).AudioContext;
      (window as any).AudioContext = function (...args: unknown[]) {
        (window as any).__audio++;
        return Orig ? new Orig(...args) : {};
      };
    });
  }
  const errors: string[] = [];
  b.page.on('pageerror', (e) => errors.push(e.message));

  const code = await createRoom(a);
  await joinRoom(b, code);
  await startGame(a.page, [{ gameId: 'ping', settings: { mode: 'turns', rounds: 1, turnSeconds: 30 } }]);
  await expect(a.page.getByTestId('turn-status')).toHaveText('Your turn');
  await expect(b.page.getByTestId('turn-status')).toHaveText('Waiting for Anu');
  await a.page.getByTestId('ping').click();
  await expect(b.page.getByTestId('turn-status')).toHaveText('Your turn');
  await expect(a.page.getByTestId('turn-status')).toHaveText('Waiting for Babu');

  const vibes = await a.page.evaluate(() => (window as any).__vibes as number[]);
  expect(vibes.length).toBe(1);
  expect(vibes[0]).toBeLessThanOrEqual(200);
  expect(errors).toEqual([]);
  for (const p of [a, b]) {
    expect(await p.page.evaluate(() => document.querySelectorAll('audio').length)).toBe(0);
    expect(await p.page.evaluate(() => (window as any).__audio)).toBe(0);
  }
  await closeAll([a, b]);
});
