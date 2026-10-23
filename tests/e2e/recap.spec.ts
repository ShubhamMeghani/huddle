import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { closeAll, quizQueue, roomOf, snapshotOf, startGame } from './helpers';

test('AC-54 the recap card is a 1080 × 1350 PNG under 1 MB; Share sends the file, or downloads it where sharing is unavailable', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  await a.context.addInitScript(() => {
    (window as any).__shared = [];
    (navigator as any).canShare = () => true;
    (navigator as any).share = async (d: { files: File[] }) => {
      (window as any).__shared.push(d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
    };
  });
  await b.context.addInitScript(() => {
    (navigator as any).share = undefined;
  });
  await a.page.reload();
  await b.page.reload();
  await startGame(a.page, quizQueue(1, 10));
  await a.page.getByTestId('quiz-option-0').click();
  await b.page.getByTestId('quiz-option-1').click();
  await expect(a.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  await a.page.getByTestId('end-night').click();
  await expect(a.page.getByTestId('night-summary')).toBeVisible();

  const roomId = (await snapshotOf(a.page)).public.roomId;
  const res = await a.page.request.get(`/api/recap/${roomId}/image`);
  expect(res.headers()['content-type']).toContain('image/png');
  const body = await res.body();
  expect(body.length).toBeLessThan(1024 * 1024);
  const png = PNG.sync.read(body);
  expect([png.width, png.height]).toEqual([1080, 1350]);

  await a.page.getByTestId('recap-share').click();
  await expect.poll(() => a.page.evaluate(() => (window as any).__shared.length)).toBe(1);
  const shared = await a.page.evaluate(() => (window as any).__shared[0]);
  expect(shared[0]).toMatchObject({ name: 'huddle-recap.png', type: 'image/png' });

  await expect(b.page.getByTestId('night-summary')).toBeVisible();
  const download = b.page.waitForEvent('download');
  await b.page.getByTestId('recap-share').click();
  expect((await download).suggestedFilename()).toBe('huddle-recap.png');
  await closeAll(players);
});
