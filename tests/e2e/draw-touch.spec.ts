import { expect, test } from '@playwright/test';
import { closeAll, drawQueue, findDrawer, opDigest, roomOf, startGame } from './helpers';

test('AC-88 a touch drag on the canvas draws for everyone without scrolling or zooming the page', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  await startGame(players[0].page, drawQueue(1, 60));
  const drawer = await findDrawer(players);
  const viewer = players.find((p) => p !== drawer)!;
  await drawer.page.getByTestId('draw-choice-0').click();
  const canvas = drawer.page.getByTestId('draw-canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');

  const before = await drawer.page.evaluate(() => ({ y: window.scrollY, s: window.visualViewport?.scale ?? 1 }));
  // A finger drag: touch-type pointer events plus the native touchmove the browser would also send.
  await canvas.evaluate(async (el) => {
    const r = el.getBoundingClientRect();
    const fire = (type: string, x: number, y: number) =>
      el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: 1 }));
    const touch = (type: string, x: number, y: number) => {
      try {
        const t = new Touch({ identifier: 7, target: el, clientX: x, clientY: y });
        const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      } catch {
        return true; // TouchEvent constructor unavailable: nothing to scroll
      }
    };
    const x0 = r.left + r.width * 0.2;
    const y0 = r.top + r.height * 0.2;
    fire('pointerdown', x0, y0);
    touch('touchstart', x0, y0);
    for (let i = 1; i <= 20; i++) {
      const x = x0 + (r.width * 0.6 * i) / 20;
      const y = y0 + (r.height * 0.5 * i) / 20;
      fire('pointermove', x, y);
      if (!touch('touchmove', x, y)) throw new Error('touchmove was not prevented: the page could scroll');
      await new Promise((res) => setTimeout(res, 16));
    }
    fire('pointerup', x0 + r.width * 0.6, y0 + r.height * 0.5);
  });
  const after = await drawer.page.evaluate(() => ({ y: window.scrollY, s: window.visualViewport?.scale ?? 1 }));
  expect(after).toEqual(before);
  await drawer.page.waitForTimeout(400);
  const want = await opDigest(drawer.page);
  expect(want).not.toMatch(/^0:/);
  await expect.poll(() => opDigest(viewer.page), { timeout: 3000 }).toBe(want);
  await closeAll(players);
});
