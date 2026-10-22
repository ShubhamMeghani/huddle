import { expect, test } from '@playwright/test';
import { closeAll, roomOf, snapshotOf, startGame } from './helpers';

test('AC-75 four phones vote; totals are revealed in ascending order with the winner highlighted; no payload carries who voted for whom', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  const bodies: string[] = [];
  for (const p of players) {
    p.page.on('response', async (r) => {
      if (r.url().includes('/api/realtime/stream')) return;
      try {
        bodies.push(await r.text());
      } catch {}
    });
  }
  await startGame(players[0].page, [{ gameId: 'mlt', settings: { rounds: 1, voteSeconds: 30, selfVote: false } }]);
  const seats = (await snapshotOf(players[0].page)).public.seats as { id: string; name: string }[];
  const idOf = (name: string) => seats.find((s) => s.name === name)!.id;
  // Bilal gets 3 votes, Asha 1.
  const votes: [number, string][] = [
    [0, 'Bilal'],
    [1, 'Asha'],
    [2, 'Bilal'],
    [3, 'Bilal'],
  ];
  await Promise.all(votes.map(([i, target]) => players[i].page.locator(`[data-testid=mlt-vote-for][data-seat-id=${idOf(target)}]`).click()));
  await Promise.all(
    players.map(async (p) => {
      await expect(p.page.getByTestId('mlt-total')).toHaveCount(4, { timeout: 15_000 });
      const counts = await p.page.getByTestId('mlt-total').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-votes'))));
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
      expect(counts.at(-1)).toBe(3);
      await expect(p.page.locator('[data-testid=mlt-total][data-winner=true]')).toContainText('Bilal');
    }),
  );
  const frames = (
    await Promise.all(players.map((p) => p.page.evaluate(() => ((window as unknown as { __huddleLog?: string[] }).__huddleLog ?? []).join('\n'))))
  ).join('\n');
  const all = bodies.join('\n') + frames;
  for (const [i, target] of votes) {
    const voter = idOf(players[i].name);
    expect(all).not.toContain(`"${voter}":"${idOf(target)}"`);
  }
  expect(all).not.toMatch(/"votes":\{"s\d/);
  await closeAll(players);
});
