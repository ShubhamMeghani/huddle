import { expect, test } from '@playwright/test';
import { closeAll, roomOf, snapshotOf, startGame } from './helpers';

test('AC-73 five phones: one different word, clues, discussion, vote, reveal and a successful steal', async ({ browser }) => {
  test.setTimeout(150_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev', 'Esha'], 'imposter-seed-73');
  await startGame(players[0].page, [
    { gameId: 'imposter', settings: { rounds: 1, clueRounds: 1, clueSeconds: 20, discussSeconds: 30, voteSeconds: 20, twoImposters: false, imposterKnows: false } },
  ]);
  const words = await Promise.all(players.map((p) => p.page.getByTestId('imposter-word').textContent()));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w!, (counts.get(w!) ?? 0) + 1);
  expect(counts.size).toBe(2);
  const crewWord = [...counts].find(([, n]) => n === 4)![0];
  const impIdx = words.findIndex((w) => w !== crewWord);
  const imp = players[impIdx];
  const crew = players.filter((p) => p !== imp);

  // Clue round: whoever's turn it is gives a neutral one-word clue.
  for (let given = 0; given < 5; ) {
    for (const p of players) {
      const input = p.page.getByTestId('clue-input');
      if (await input.isVisible().catch(() => false)) {
        await input.fill('quokka');
        await p.page.getByTestId('clue-send').click();
        await expect(input).toHaveCount(0);
        given++;
      }
    }
  }
  for (const p of players) await expect(p.page.getByTestId('clue')).toHaveCount(5);

  for (const p of players) await p.page.getByTestId('imposter-ready').click();
  for (const p of crew) await p.page.locator(`[data-testid=vote-for][data-seat-id]`, { hasText: imp.name }).click();
  await imp.page.locator('[data-testid=vote-for]', { hasText: crew[0].name }).click();

  await expect(imp.page.getByTestId('guess-word-input')).toBeVisible();
  for (const p of crew) await expect(p.page.getByTestId('imposter-guess')).toContainText(`${imp.name} was caught`);
  await imp.page.getByTestId('guess-word-input').fill(crewWord);
  await imp.page.getByTestId('guess-word-send').click();
  await Promise.all(
    players.map(async (p) => {
      await expect(p.page.getByTestId('imposter-outcome')).toHaveText('Imposter steals the win!');
      await expect(p.page.getByTestId('imposter-reveal')).toContainText(crewWord);
    }),
  );
  // Scores of the finished game (the scoreboard break may already be over on a slow phone).
  await expect.poll(async () => (await snapshotOf(players[0].page)).public.lastGame?.gameId, { timeout: 30_000 }).toBe('imposter');
  const rows = (await snapshotOf(players[0].page)).public.lastGame.rows as { name: string; score: number }[];
  expect(rows.find((r) => r.name === imp.name)!.score).toBe(200);
  for (const p of crew) expect(rows.find((r) => r.name === p.name)!.score).toBe(50);
  await closeAll(players);
});
