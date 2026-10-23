import { expect, test, type Page } from '@playwright/test';
import { drawLine, snapshotOf } from './helpers';

/** The visitor plays along: whatever their phone asks them to do, they do. */
async function playAlong(page: Page) {
  const tap = async (id: string) => {
    const el = page.getByTestId(id).first();
    if ((await el.isVisible().catch(() => false)) && (await el.isEnabled().catch(() => false))) {
      await el.click().catch(() => {});
      return true;
    }
    return false;
  };
  const fill = async (id: string, text: string, send: string) => {
    const el = page.getByTestId(id);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(text).catch(() => {});
      await tap(send);
    }
  };
  for (let i = 0; i < 1200; i++) {
    if (await page.getByTestId('break').isVisible().catch(() => false)) return;
    await tap('quiz-option-0');
    if (await tap('draw-choice-0')) await drawLine(page, [200, 200], [700, 500]).catch(() => {});
    await tap('charades-guessed');
    await fill('clue-input', 'mystery', 'clue-send');
    await tap('imposter-ready');
    await tap('vote-for');
    await fill('guess-word-input', 'pizza', 'guess-word-send');
    await tap('mlt-vote-for');
    await page.waitForTimeout(400);
  }
  throw new Error('game did not reach the scoreboard');
}

test('AC-47 one browser, no sign-in: /demo gives a room with 4 bots, and every game can be finished alone with real bot play', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/');
  await page.getByTestId('demo-link').click();
  await expect(page.getByTestId('demo-start')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('demo-go').click();
  await expect(page.getByTestId('demo-picker')).toBeVisible();
  await expect(page.getByTestId('seat')).toHaveCount(5);
  expect((await snapshotOf(page)).public.seats.filter((s: { isBot: boolean }) => s.isBot)).toHaveLength(4);

  for (const id of ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt']) {
    await page.getByTestId(`demo-${id}`).click();
    await expect(page.getByTestId('playing')).toHaveAttribute('data-game', id);
    await playAlong(page);
    const last = (await snapshotOf(page)).public.lastGame;
    expect(last.gameId).toBe(id);
    const botRows = (last.rows as { name: string; score: number; stats: Record<string, number> }[]).filter((r) => r.name.startsWith('Bot'));
    const activity = botRows.reduce(
      (sum, r) => sum + r.score + Object.entries(r.stats).filter(([k]) => !['afkSkips', 'missed', 'personal'].includes(k)).reduce((a, [, v]) => a + v, 0),
      0,
    );
    expect(activity, `bots did something in ${id}`).toBeGreaterThan(0);
  }
});
