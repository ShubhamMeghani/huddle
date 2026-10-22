import { expect, test, type Page } from '@playwright/test';
import { closeAll, roomOf, snapshotOf, startGame } from './helpers';

const CANDIDATES: Record<string, string[]> = {
  a: ['Agra', 'Amritsar', 'Ahmedabad', 'Austria'], b: ['Bhopal', 'Berlin', 'Bangkok', 'Brazil'], c: ['Chennai', 'Cairo', 'Chandigarh', 'Chile'],
  d: ['Delhi', 'Dhaka', 'Dubai', 'Denmark'], e: ['Egypt', 'Ethiopia', 'Ecuador', 'Estonia'], f: ['France', 'Finland', 'Fiji', 'Faridabad'],
  g: ['Goa', 'Ghana', 'Greece', 'Guwahati'], h: ['Hyderabad', 'Hanoi', 'Havana', 'Hungary'], i: ['Indore', 'India', 'Italy', 'Iran'],
  j: ['Jaipur', 'Japan', 'Jordan', 'Jamaica'], k: ['Kolkata', 'Kenya', 'Kabul', 'Kanpur'], l: ['Lucknow', 'London', 'Lima', 'Laos'],
  m: ['Mumbai', 'Madrid', 'Moscow', 'Mexico'], n: ['Nagpur', 'Nepal', 'Norway', 'Nigeria'], o: ['Oman', 'Odisha', 'Ottawa', 'Oslo'],
  p: ['Pune', 'Paris', 'Peru', 'Patna'], q: ['Qatar', 'Quito'], r: ['Ranchi', 'Rome', 'Russia', 'Rwanda'], s: ['Surat', 'Spain', 'Sweden', 'Shimla'],
  t: ['Thane', 'Tokyo', 'Turkey', 'Tunisia'], u: ['Udaipur', 'Uganda', 'Ukraine', 'Uruguay'], v: ['Varanasi', 'Vienna', 'Vietnam', 'Vadodara'],
  w: ['Warsaw', 'Wellington', 'Wuhan'], x: ['Xiamen', 'Xian'], y: ['Yemen', 'Yangon', 'Yokohama'], z: ['Zambia', 'Zimbabwe', 'Zurich'],
};

async function playValid(page: Page) {
  const letter = (await page.getByTestId('atlas-letter').textContent())!.trim().toLowerCase();
  const before = await page.getByTestId('atlas-place').count();
  for (const name of CANDIDATES[letter] ?? []) {
    await page.getByTestId('atlas-input').fill(name);
    await page.getByTestId('atlas-send').click();
    const accepted = await expect(page.getByTestId('atlas-place')).toHaveCount(before + 1, { timeout: 3000 }).then(
      () => true,
      () => false,
    );
    if (accepted) return name;
  }
  throw new Error(`no candidate accepted for ${letter}`);
}

test('AC-70 a chain of valid places, an unknown place accepted by vote, eliminations on timeout and the winner bonus', async ({ browser }) => {
  test.setTimeout(150_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu']);
  const [a, b, c] = players;
  await startGame(a.page, [{ gameId: 'atlas', settings: { seconds: 15, lives: 1, variant: 'any' } }]);

  await expect(a.page.getByTestId('atlas-input')).toBeVisible();
  await playValid(a.page);
  await expect(b.page.getByTestId('atlas-input')).toBeVisible();
  await playValid(b.page);

  // Charu offers a place the game doesn't know; the others vote it in.
  await expect(c.page.getByTestId('atlas-input')).toBeVisible();
  const letter = (await c.page.getByTestId('atlas-letter').textContent())!.trim().toLowerCase();
  const unknown = `${letter.toUpperCase()}uxquokkaville`;
  await c.page.getByTestId('atlas-input').fill(unknown);
  await c.page.getByTestId('atlas-send').click();
  for (const p of [a, b]) await expect(p.page.getByTestId('atlas-vote')).toContainText(unknown);
  await a.page.getByTestId('atlas-accept').click();
  await b.page.getByTestId('atlas-accept').click();
  await expect(a.page.getByTestId('atlas-chain')).toContainText(unknown);

  await expect(a.page.getByTestId('atlas-input')).toBeVisible();
  await playValid(a.page);
  // Bilal runs out of time and is out (one life); then Charu does too, which ends the game.
  await expect(a.page.locator('[data-testid=atlas-player][data-out=true]')).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(async () => (await snapshotOf(a.page)).public.lastGame?.gameId, { timeout: 60_000 }).toBe('atlas');
  const rows = (await snapshotOf(a.page)).public.lastGame.rows as { name: string; score: number; rank: number }[];
  expect(rows.find((r) => r.name === 'Asha')).toMatchObject({ score: 10 + 10 + 50, rank: 1 });
  expect(rows.find((r) => r.name === 'Bilal')!.score).toBe(10);
  expect(rows.find((r) => r.name === 'Charu')!.score).toBe(10);
  await closeAll(players);
});
