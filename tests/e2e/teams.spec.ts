import { expect, test, type Page } from '@playwright/test';
import { closeAll, roomOf, versionOf } from './helpers';

async function teamsOf(page: Page): Promise<string> {
  const teams = page.getByTestId('team');
  const n = await teams.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const ids = await teams.nth(i).getByTestId('team-member').evaluateAll((els) => els.map((e) => e.getAttribute('data-seat-id')).sort());
    out.push(ids.join(','));
  }
  return out.sort().join(' | ');
}

test('AC-36 admin balances, moves and shuffles teams; every phone shows the new teams within 1 s', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Admin', 'Bina', 'Chirag', 'Dia']);
  const [a] = players;
  await a.page.getByTestId('teams-balance').click();
  await expect(a.page.getByTestId('team')).toHaveCount(2);
  // Compare once the admin's phone has settled on a version; others must match it within 1 s.
  const expectSame = async () => {
    await expect.poll(async () => {
      const v1 = await versionOf(a.page);
      await a.page.waitForTimeout(150);
      return v1 === (await versionOf(a.page));
    }).toBe(true);
    const v = await versionOf(a.page);
    const want = await teamsOf(a.page);
    for (const p of players.slice(1)) {
      await expect.poll(() => versionOf(p.page), { timeout: 1000 }).toBe(v);
      expect(await teamsOf(p.page)).toBe(want);
    }
    return want;
  };
  const balanced = await expectSame();

  const firstMember = a.page.getByTestId('team').first().getByTestId('team-member').first();
  const moved = await firstMember.getAttribute('data-seat-id');
  await a.page.getByTestId(`move-${moved}`).click();
  await expect.poll(() => teamsOf(a.page)).not.toBe(balanced);
  await expectSame();

  await a.page.getByTestId('teams-count-3').click();
  await expect(a.page.getByTestId('team')).toHaveCount(3);
  await expectSame();
  await a.page.getByTestId('teams-shuffle').click();
  await expectSame();
  await closeAll(players);
});
