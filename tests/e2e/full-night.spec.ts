import { expect, test } from '@playwright/test';
import { act, closeAll, playUntil, roomOf, startGame } from './helpers';

const ALL = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];

test('full-night regression: 8 phones play all six games with reloads, a Wi-Fi drop, an AFK player and the admin leaving', async ({ browser }) => {
  test.setTimeout(900_000);
  const names = ['Admin', 'Bilal', 'Charu', 'Dev', 'Esha', 'Farhan', 'Gauri', 'Hari'];
  const { code, players } = await roomOf(browser, names);
  const [admin, reloader, dropper, afk, ...rest] = players;
  await act(admin.page, 'setTeams', { mode: 'shuffle', count: 2 });
  await startGame(admin.page, [
    { gameId: 'quiz', settings: { questions: 2, seconds: 8, categories: ALL, difficulty: 'any', mode: 'solo' } },
    { gameId: 'draw', settings: { rounds: 1, drawSeconds: 5, hints: 1, words: 'mixed' } },
    { gameId: 'imposter', settings: { rounds: 1, clueRounds: 1, clueSeconds: 5, discussSeconds: 5, voteSeconds: 6, twoImposters: true, imposterKnows: false } },
    { gameId: 'atlas', settings: { seconds: 4, lives: 1, variant: 'any' } },
    { gameId: 'charades', settings: { rounds: 1, seconds: 6, passes: 1, industries: ['bollywood', 'hollywood'], eras: ['modern'], difficulty: 'easy', steal: true } },
    { gameId: 'mlt', settings: { rounds: 1, voteSeconds: 6, selfVote: false } },
  ]);
  await admin.context.close(); // the admin leaves; nobody runs the night by hand

  const stayers = [reloader, dropper, afk, ...rest];
  const loops = stayers.map((p) => playUntil(p.page, 'night-summary', 800_000).catch((e) => e));

  // Disruptions while everyone plays along.
  await expect(reloader.page.getByTestId('quiz')).toBeVisible();
  await reloader.page.reload();
  await expect(dropper.page.getByTestId('draw')).toBeVisible({ timeout: 120_000 });
  await dropper.context.setOffline(true);
  await dropper.page.waitForTimeout(6_000);
  await dropper.context.setOffline(false);
  await expect(afk.page.getByTestId('imposter')).toBeVisible({ timeout: 180_000 });
  await afk.page.close(); // gone for the rest of the night

  const results = await Promise.all(loops);
  const live = stayers.filter((p) => p !== afk);
  for (const [i, p] of stayers.entries()) if (p !== afk) expect(results[i], `${p.name} reached the night summary`).toBeUndefined();
  for (const p of live) await expect(p.page.getByTestId('night-game')).toHaveCount(6);
  const boards = await Promise.all(live.map((p) => p.page.getByTestId('night-standings').textContent()));
  expect(new Set(boards).size).toBe(1);
  void code;
  await closeAll(players);
});
