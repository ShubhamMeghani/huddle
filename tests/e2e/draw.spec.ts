import { expect, test } from '@playwright/test';
import { closeAll, drawLine, drawQueue, findDrawer, opDigest, roomOf, startGame } from './helpers';

test('AC-66 live drawing with every tool reaches all phones; close and correct guesses behave', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  await startGame(players[0].page, drawQueue(1, 60));
  const drawer = await findDrawer(players);
  const guessers = players.filter((p) => p !== drawer);
  await drawer.page.getByTestId('draw-choice-0').click();
  const word = (await drawer.page.getByTestId('draw-word').textContent())!.trim();
  for (const g of guessers) await expect(g.page.getByTestId('draw-mask')).toBeVisible();

  // Colour, size, eraser, undo, clear.
  await drawer.page.getByTestId('color-3').click();
  await drawer.page.getByTestId('size-2').click();
  await drawLine(drawer.page, [100, 100], [600, 400]);
  await drawLine(drawer.page, [100, 600], [800, 200]);
  await drawer.page.getByTestId('tool-eraser').click();
  await drawLine(drawer.page, [300, 300], [400, 350]);
  await drawer.page.getByTestId('tool-undo').click();
  await drawer.page.getByTestId('tool-clear').click();
  await drawer.page.getByTestId('tool-eraser').click();
  await drawer.page.getByTestId('color-8').click();
  await drawLine(drawer.page, [200, 200], [800, 600]);
  await expect.poll(() => drawer.page.getByTestId('draw-canvas').getAttribute('data-op-count')).not.toBe('0');
  await drawer.page.waitForTimeout(400); // last 200 ms batch
  const want = await opDigest(drawer.page);
  for (const g of guessers) await expect.poll(() => opDigest(g.page), { timeout: 1500 }).toBe(want);

  // Near miss: only that guesser is told.
  const near = word.slice(0, -1) + (word.endsWith('z') ? 'y' : 'z');
  await guessers[0].page.getByTestId('guess-input').fill(near);
  await guessers[0].page.getByTestId('guess-send').click();
  await expect(guessers[0].page.getByTestId('close-toast')).toBeVisible();
  for (const g of guessers.slice(1)) await expect(g.page.getByTestId('close-toast')).toHaveCount(0);

  // Correct: others see "<name> guessed it!", never the text.
  await guessers[1].page.getByTestId('guess-input').fill(word);
  await guessers[1].page.getByTestId('guess-send').click();
  for (const p of [drawer, guessers[0], guessers[2]]) {
    await expect(p.page.getByTestId('chat-correct')).toContainText(`${guessers[1].name} guessed it!`);
  }
  for (const p of [guessers[0], guessers[2]]) {
    const chat = (await p.page.getByTestId('draw-chat').textContent())!.toLowerCase();
    expect(chat).not.toContain(word.toLowerCase());
  }

  // Everyone else guesses: the turn ends and the word is revealed to all.
  for (const g of [guessers[0], guessers[2]]) {
    await g.page.getByTestId('guess-input').fill(word);
    await g.page.getByTestId('guess-send').click();
  }
  for (const p of players) await expect(p.page.getByTestId('draw-reveal')).toContainText(word);
  await closeAll(players);
});
