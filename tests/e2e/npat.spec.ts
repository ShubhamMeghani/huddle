import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { closeAll, roomOf, snapshotOf, startGame } from './helpers';

const places = JSON.parse(readFileSync('data/places.json', 'utf8')) as { name: string; alt: string[]; kind: string }[];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function write(page: Page, answers: Record<string, string>) {
  for (const [cat, text] of Object.entries(answers)) await page.getByTestId(`npat-input-${cat}`).fill(text);
}

test('AC-98 three phones: one letter, secret answers, Atlas-checked places, a majority vote throws out a fake, unique 10 / shared 5', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu']);
  const [a, b, c] = players;
  await startGame(a.page, [{ gameId: 'npat', settings: { rounds: 1, seconds: 90, movie: false } }]);
  const letter = (await a.page.getByTestId('npat-letter').textContent())!.trim();
  for (const p of players) await expect(p.page.getByTestId('npat-letter')).toHaveText(letter);
  const L = letter.toLowerCase();
  const fits = (p: { name: string }) => fold(p.name)[0] === L && p.name.length <= 30; // answers are at most 30 characters
  const place = places.find((p) => p.kind === 'country' && fits(p)) ?? places.find(fits)!;

  await write(a.page, { name: `${letter}eena`, place: place.name, animal: `${letter}anther`, thing: `${letter}ottle` });
  await write(b.page, { name: `${letter}ohan`, place: place.name, animal: `${letter}anther`, thing: `${letter}ucket` });
  await write(c.page, { name: `${letter}ikram`, thing: `${letter}lorpx` });
  // Answers are private while writing: other phones neither show nor receive them.
  await a.page.waitForTimeout(1500); // past the 1 s autosave
  for (const other of [b, c]) {
    await expect(other.page.getByText(`${letter}eena`)).toHaveCount(0);
    expect(JSON.stringify(await snapshotOf(other.page))).not.toContain(`${letter}eena`);
  }
  for (const p of players) await p.page.getByTestId('npat-done').click();

  for (const p of players) await expect(p.page.getByTestId('npat-vote-help')).toBeVisible();
  const fake = `[data-testid=npat-item][data-key="thing:${fold(`${letter}lorpx`)}"]`;
  for (const p of [a, b]) {
    await p.page.locator(fake).getByTestId('npat-reject').click();
    await expect(p.page.locator(fake).getByTestId('npat-reject')).toHaveAttribute('aria-pressed', 'true');
  }
  // C cannot vote on their own answer; the known place needs no vote.
  await expect(c.page.locator(fake).getByTestId('npat-reject')).toBeDisabled();
  await expect(a.page.locator('[data-testid=npat-item][data-check=ok]')).toContainText(place.name);
  for (const p of players) await p.page.getByTestId('npat-vote-done').click();

  const seats = (await snapshotOf(a.page)).public.seats as { id: string; name: string }[];
  const expected: Record<string, number> = { Asha: 30, Bilal: 30, Charu: 10 };
  for (const p of players) {
    await expect(p.page.getByTestId('npat-results')).toBeVisible();
    for (const s of seats) await expect(p.page.locator(`[data-testid=npat-points][data-seat-id=${s.id}]`)).toHaveAttribute('data-points', String(expected[s.name]));
    await expect(p.page.locator(fake)).toHaveAttribute('data-valid', 'false');
  }
  await closeAll(players);
});
