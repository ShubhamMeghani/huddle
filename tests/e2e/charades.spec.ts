import { expect, test } from '@playwright/test';
import { act, closeAll, roomOf, startGame } from './helpers';

const charades = (extra: Record<string, unknown> = {}) => ({
  gameId: 'charades',
  settings: { rounds: 1, seconds: 60, passes: 1, industries: ['bollywood', 'hollywood'], eras: ['classic', 'golden', 'modern'], difficulty: 'any', steal: false, ...extra },
});

test('AC-62 two teams of two: only the actor sees the title; Pass gives a new title; Guessed updates scores everywhere and reveals the title', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  await act(players[0].page, 'setTeams', { mode: 'shuffle', count: 2 });
  await startGame(players[0].page, [charades()]);
  let actorIdx = -1;
  await expect
    .poll(async () => {
      for (let i = 0; i < 4; i++) if (await players[i].page.getByTestId('charades-actor').isVisible()) actorIdx = i;
      return actorIdx;
    })
    .toBeGreaterThanOrEqual(0);
  const actor = players[actorIdx];
  const others = players.filter((p) => p !== actor);
  const title1 = (await actor.page.getByTestId('charades-title').textContent())!;
  for (const p of others) {
    await expect(p.page.getByTestId('charades-watch')).toBeVisible();
    expect(await p.page.content()).not.toContain(title1);
  }
  await actor.page.getByTestId('charades-pass').click();
  await expect(actor.page.getByTestId('charades-title')).not.toHaveText(title1);
  const title2 = (await actor.page.getByTestId('charades-title').textContent())!;
  await actor.page.getByTestId('charades-guessed').click();
  await Promise.all(players.map((p) => expect(p.page.getByTestId('charades-revealed-title')).toHaveText(title2)));
  const scores = await Promise.all(
    players.map((p) => p.page.getByTestId('team-score-value').evaluateAll((els) => els.map((e) => Number(e.textContent)))),
  );
  for (const s of scores) expect(s).toEqual(scores[0]);
  expect(Math.max(...scores[0])).toBeGreaterThanOrEqual(10);
  await closeAll(players);
});

test('AC-34 queue Quiz (5 questions, 15 s) then Charades with those rules; break between; Rematch replays Charades with identical teams', async ({ browser }) => {
  test.setTimeout(240_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  const a = players[0].page;
  await act(a, 'setTeams', { mode: 'shuffle', count: 2 });
  const quiz = { gameId: 'quiz', settings: { questions: 5, seconds: 15, categories: ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'], difficulty: 'any', mode: 'solo' } };
  await startGame(a, [quiz, charades({ seconds: 5 })]);
  await expect(a.getByTestId('quiz-progress')).toContainText('/ 5');
  for (let q = 1; q <= 5; q++) {
    await expect(a.getByTestId('quiz-progress')).toContainText(`Question ${q} /`, { timeout: 30_000 });
    expect(Number(await a.getByTestId('countdown').getAttribute('data-seconds'))).toBeLessThanOrEqual(15);
    await Promise.all(players.map((p, i) => p.page.getByTestId(`quiz-option-${i}`).click()));
  }
  await expect(a.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  await expect(a.getByTestId('next-up')).toContainText('Dumb Charades');
  await a.getByTestId('continue').click();
  await expect(a.getByTestId('charades')).toBeVisible();
  const teamsBefore = JSON.stringify(await a.evaluate(() => (window as any).__huddleSync.state.snapshot.public.teams));
  // Both 5-second team turns time out, then the break.
  await expect(a.getByTestId('break')).toBeVisible({ timeout: 60_000 });
  await a.getByTestId('rematch').click();
  await expect(a.getByTestId('charades')).toBeVisible();
  const teamsAfter = JSON.stringify(await a.evaluate(() => (window as any).__huddleSync.state.snapshot.public.teams));
  expect(teamsAfter).toBe(teamsBefore);
  await closeAll(players);
});
