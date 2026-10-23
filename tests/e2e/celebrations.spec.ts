import { expect, test, type Browser } from '@playwright/test';
import { closeAll, createRoom, deviceOptions, joinRoom, quizQueue, snapshotOf, startGame, type Player } from './helpers';

async function quizNight(browser: Browser, reducedMotion: 'reduce' | 'no-preference') {
  const mk = async (name: string): Promise<Player> => {
    const context = await browser.newContext({ ...deviceOptions(), reducedMotion });
    return { name, context, page: await context.newPage() };
  };
  const a = await mk('Asha');
  const b = await mk('Bilal');
  const code = await createRoom(a);
  await joinRoom(b, code);
  await startGame(a.page, quizQueue(1, 20));
  await a.page.getByTestId('quiz-option-0').click();
  await b.page.getByTestId('quiz-option-1').click();
  for (const p of [a, b]) await expect(p.page.getByTestId('quiz-reveal')).toHaveAttribute('data-reveal-card', 'true');
  for (const p of [a, b]) await expect(p.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  const rows = (await snapshotOf(a.page)).public.lastGame.rows as { seatId: string; rank: number; name: string }[];
  const winner = [a, b].find((p) => rows.some((r) => r.name === p.name && r.rank === 1))!;
  return { a, b, winner };
}

test('AC-85 the winner sees confetti, scores bounce and reveals use the reveal card', async ({ browser }) => {
  const { a, b, winner } = await quizNight(browser, 'no-preference');
  await expect(winner.page.getByTestId('you-won')).toBeVisible();
  await expect(winner.page.getByTestId('confetti')).toHaveCount(1);
  expect(await winner.page.locator('[data-testid=standing-score].bump').count()).toBeGreaterThan(0);
  await closeAll([a, b]);
});

test('AC-85 with reduced motion: no confetti and no animation longer than 150 ms, same results shown', async ({ browser }) => {
  const { a, b, winner } = await quizNight(browser, 'reduce');
  await expect(winner.page.getByTestId('you-won')).toBeVisible();
  await expect(winner.page.getByTestId('confetti')).toHaveCount(0);
  const long = await winner.page.evaluate(() =>
    document
      .getAnimations()
      .map((x) => Number((x.effect?.getTiming().duration as number) ?? 0))
      .filter((d) => d > 150),
  );
  expect(long).toEqual([]);
  await expect(winner.page.getByTestId('standing')).toHaveCount(2);
  await closeAll([a, b]);
});
