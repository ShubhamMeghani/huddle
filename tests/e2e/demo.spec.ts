import { expect, test } from '@playwright/test';
import { act, actionPacer, GAME_IDS, openDemo, playUntil, snapshotOf } from './helpers';

// Regression (first CI run): six demo games started and ended back to back sent 12 admin actions in under a
// second; the 11th, the Most Likely To start, was rate limited (R46) and silently dropped. Driving the sync client
// directly is as fast as that runner was on any machine, so without pacing this fails at the 11th action.
test('AC-47 all six demo games started and ended back to back as fast as the server allows: every start and end is accepted', async ({ page }) => {
  await openDemo(page);
  const pacer = actionPacer(page);
  const results: string[] = [];
  for (const id of GAME_IDS) {
    await pacer.ready();
    results.push(`${id} start ${(await act(page, 'demoStart', { gameId: id })).code ?? 'ok'}`);
    await expect(page.getByTestId('playing')).toHaveAttribute('data-game', id);
    await pacer.ready();
    results.push(`${id} end ${(await act(page, 'endGame')).code ?? 'ok'}`);
    await expect(page.getByTestId('break')).toBeVisible();
  }
  pacer.stop();
  expect(results).toEqual(GAME_IDS.flatMap((id) => [`${id} start ok`, `${id} end ok`]));
  const night = (await snapshotOf(page)).public.night as { gameId: string }[];
  expect(night.map((g) => g.gameId)).toEqual([...GAME_IDS]);
});

test('AC-49 a demo start rejected by the rate limit is shown to the player, and works once the second has passed', async ({ page }) => {
  await openDemo(page);
  const pacer = actionPacer(page);
  // Ten actions in a burst use up this seat's second; the next tap must be refused visibly, not dropped.
  await Promise.all(Array.from({ length: 10 }, () => act(page, 'wave')));
  await page.getByTestId('demo-mlt').click();
  await expect(page.getByTestId('demo-error')).toContainText('Wait a second');
  await expect(page.getByTestId('playing')).toHaveCount(0);
  await pacer.ready();
  await page.getByTestId('demo-mlt').click();
  await expect(page.getByTestId('playing')).toHaveAttribute('data-game', 'mlt');
  pacer.stop();
});

test('AC-47 one browser, no sign-in: /demo gives a room with 4 bots, and every game can be finished alone with real bot play', async ({ page }) => {
  test.setTimeout(300_000); // ~3 min on a 4-core Linux runner
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
    await playUntil(page, 'break', 120_000); // the visitor does whatever their phone asks
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
