import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { closeAll, roomOf, snapshotOf, startGame } from './helpers';

const places = JSON.parse(readFileSync('data/places.json', 'utf8')) as { name: string; alt: string[]; kind: string; country: string; inIndia: boolean }[];
const bank = JSON.parse(readFileSync('content/emoji.json', 'utf8')) as { emoji: string; answer: string; category: string; country?: string }[];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

test('AC-101 two phones decode a city: the answer stays hidden, wrong guesses are private, another name for the place counts, speed scores more', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  await startGame(a.page, [{ gameId: 'emoji', settings: { rounds: 1, seconds: 40, categories: ['cities'] } }]);
  const clue = (await a.page.getByTestId('emoji-clue').textContent())!.trim();
  await expect(b.page.getByTestId('emoji-clue')).toHaveText(clue);
  const puzzle = bank.find((p) => p.emoji === clue)!;
  expect(puzzle.category).toMatch(/^city_/);
  // Another name the place database knows for this city (e.g. Bombay for Mumbai, Dārjiling for Darjeeling).
  const dbPlace = places.find(
    (p) =>
      p.kind !== 'country' &&
      p.inIndia === (puzzle.category === 'city_india') &&
      (!puzzle.country || p.country === puzzle.country) &&
      [p.name, ...p.alt].some((n) => fold(n) === fold(puzzle.answer)),
  )!;
  const altName = [dbPlace.name, ...dbPlace.alt].find((n) => fold(n) && fold(n) !== fold(puzzle.answer) && /^[\x20-\x7e]+$/.test(n)) ?? puzzle.answer.toUpperCase();

  expect(JSON.stringify(await snapshotOf(b.page)).toLowerCase()).not.toContain(fold(puzzle.answer));
  await a.page.getByTestId('emoji-input').fill('Atlantis');
  await a.page.getByTestId('emoji-send').click();
  await expect(a.page.getByTestId('emoji-feedback')).toContainText('isn’t it');
  await expect(b.page.getByText('Atlantis')).toHaveCount(0);

  await a.page.getByTestId('emoji-input').fill(puzzle.answer.toLowerCase());
  await a.page.getByTestId('emoji-send').click();
  await expect(a.page.getByTestId('emoji-feedback')).toContainText('Correct');
  await expect(b.page.getByTestId('emoji-solved')).toContainText('Asha got it!');
  await expect(b.page.getByTestId('emoji-answer')).toHaveCount(0);

  await b.page.getByTestId('emoji-input').fill(altName);
  await b.page.getByTestId('emoji-send').click();
  for (const p of players) await expect(p.page.getByTestId('emoji-answer')).toHaveText(puzzle.answer);
  const view = (await snapshotOf(a.page)).public.game.view as { points: Record<string, number> };
  const seats = (await snapshotOf(a.page)).public.seats as { id: string; name: string }[];
  const pts = (n: string) => view.points[seats.find((s) => s.name === n)!.id];
  expect(pts('Asha')).toBeGreaterThan(500);
  expect(pts('Bilal')).toBeGreaterThanOrEqual(500);
  expect(pts('Asha')).toBeGreaterThanOrEqual(pts('Bilal'));
  await expect(a.page.getByTestId('emoji-my-points')).toHaveText(`+${pts('Asha')} points`);
  await closeAll(players);
});
