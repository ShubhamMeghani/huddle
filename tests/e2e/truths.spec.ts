import { expect, test } from '@playwright/test';
import { act, closeAll, roomOf, snapshotOf, startGame } from './helpers';

const ENTRIES: Record<string, { texts: string[]; lie: number }> = {
  Asha: { texts: ['I have a pet parrot', 'I was born in Pune', 'I have met the Prime Minister'], lie: 2 },
  Bilal: { texts: ['I can play the flute', 'I have never been to Goa', 'I hate mangoes'], lie: 1 },
  Charu: { texts: ['I ran a marathon', 'I speak Tamil', 'I own 40 sneakers'], lie: 0 },
};

test('AC-103 three phones: secret statements, shuffled on each turn, votes for the lie, reveal and points', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu']);
  const [a, b, c] = players;
  await startGame(a.page, [{ gameId: 'truths', settings: { writeSeconds: 120, voteSeconds: 40 } }]);
  for (const p of players) {
    const e = ENTRIES[p.name];
    for (let i = 0; i < 3; i++) await p.page.getByTestId(`truths-input-${i}`).fill(e.texts[i]);
    await p.page.getByTestId(`truths-lie-${e.lie}`).click();
  }
  // Nobody else sees or receives statements while writing.
  await a.page.waitForTimeout(1500); // past the 1 s autosave
  await expect(b.page.getByText('pet parrot')).toHaveCount(0);
  expect(JSON.stringify(await snapshotOf(b.page))).not.toContain('pet parrot');
  for (const p of players) {
    await p.page.getByTestId('truths-submit').click();
    // Locked in, or straight into the first turn once the last player has submitted.
    await expect(p.page.getByTestId('truths-locked').or(p.page.getByTestId('truths-subject'))).toBeVisible();
  }

  // Asha's turn: the others see her three statements; only Asha's phone marks the lie.
  for (const p of players) await expect(p.page.getByTestId('truths-subject')).toBeVisible();
  await expect(b.page.getByTestId('truths-subject')).toContainText('Asha');
  const shown = await Promise.all([0, 1, 2].map((i) => b.page.getByTestId(`truths-choice-${i}`).textContent()));
  expect([...shown].map((t) => t!.trim()).sort()).toEqual([...ENTRIES.Asha.texts].sort());
  const lieIdx = shown.findIndex((t) => t!.includes('Prime Minister'));
  await expect(a.page.getByTestId(`truths-choice-${lieIdx}`)).toContainText('your lie');
  await expect(b.page.getByText('your lie')).toHaveCount(0);
  await expect(a.page.getByTestId('truths-choice-0')).toBeDisabled();
  await b.page.getByTestId(`truths-choice-${lieIdx}`).click();
  await c.page.getByTestId(`truths-choice-${(lieIdx + 1) % 3}`).click();

  for (const p of players) {
    await expect(p.page.getByTestId('truths-reveal')).toBeVisible();
    await expect(p.page.getByTestId(`truths-choice-${lieIdx}`)).toHaveAttribute('data-lie', 'true');
  }
  const seats = (await snapshotOf(a.page)).public.seats as { id: string; name: string }[];
  const idOf = (n: string) => seats.find((s) => s.name === n)!.id;
  await expect(c.page.locator(`[data-testid=truths-points][data-seat-id=${idOf('Asha')}]`)).toHaveAttribute('data-points', '50');
  await expect(c.page.locator(`[data-testid=truths-points][data-seat-id=${idOf('Bilal')}]`)).toHaveAttribute('data-points', '100');

  expect((await act(a.page, 'endGame')).ok).toBe(true);
  const rows = (await snapshotOf(a.page)).public.lastGame.rows as { name: string; score: number }[];
  expect(Object.fromEntries(rows.map((r) => [r.name, r.score]))).toEqual({ Asha: 50, Bilal: 100, Charu: 0 });
  await closeAll(players);
});
