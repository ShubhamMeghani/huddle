import { expect, test } from '@playwright/test';
import { atQuestion, closeAll, joinRoom, newPlayer, quizQueue, roomOf, startGame } from './helpers';

test('AC-58 four phones play three questions: same question and countdown, reveal with distribution, identical scoreboards', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev'], 'quiz-seed-58');
  await startGame(players[0].page, quizQueue(3, 20));
  const totals = new Map<string, number>(players.map((p) => [p.name, 0]));
  for (let q = 1; q <= 3; q++) {
    for (const p of players) await atQuestion(p.page, q);
    const texts = await Promise.all(players.map((p) => p.page.getByTestId('quiz-question').textContent()));
    expect(new Set(texts).size).toBe(1);
    const secs = await Promise.all(players.map((p) => p.page.getByTestId('countdown').getAttribute('data-seconds')));
    expect(Math.max(...secs.map(Number)) - Math.min(...secs.map(Number))).toBeLessThanOrEqual(1);
    // Each player picks a different option, so exactly one is right.
    for (let i = 0; i < 4; i++) await players[i].page.getByTestId(`quiz-option-${i}`).click();
    for (const p of players) await expect(p.page.getByTestId('quiz-reveal')).toBeVisible();
    let correct = -1;
    for (let i = 0; i < 4; i++) if ((await players[0].page.getByTestId(`quiz-option-${i}`).getAttribute('data-correct')) === 'true') correct = i;
    expect(correct).toBeGreaterThanOrEqual(0);
    await Promise.all(
      players.map(async (p) => {
        for (let i = 0; i < 4; i++) await expect(p.page.getByTestId(`quiz-dist-${i}`)).toHaveText('1');
        await expect(p.page.locator('[data-testid^=quiz-option-][data-correct=true]')).toHaveAttribute('data-testid', `quiz-option-${correct}`);
      }),
    );
    const winnerText = (await players[correct].page.getByTestId('quiz-my-points').textContent())!;
    const pts = Number(winnerText.match(/\+(\d+)/)![1]);
    expect(pts).toBeGreaterThanOrEqual(500);
    expect(pts).toBeLessThanOrEqual(1000);
    totals.set(players[correct].name, totals.get(players[correct].name)! + pts);
    await Promise.all(
      players.map((p, i) => (i === correct ? null : expect(p.page.getByTestId('quiz-my-points')).toHaveText('No points this time'))),
    );
  }
  for (const p of players) await expect(p.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  const boards = await Promise.all(
    players.map((p) => p.page.getByTestId('standing').evaluateAll((els) => els.map((e) => `${e.textContent}`).join('|'))),
  );
  expect(new Set(boards).size).toBe(1);
  for (const p of players) {
    const row = players[0].page.locator('[data-testid=standing]', { hasText: p.name });
    await expect(row.getByTestId('standing-score')).toHaveText(String(totals.get(p.name)));
  }
  await closeAll(players);
});

test('AC-11 a fifth player joining during question 2 watches live and is seated with 0 points at question 3', async ({ browser }) => {
  const { code, players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  await startGame(players[0].page, quizQueue(3, 30));
  for (const p of players) await atQuestion(p.page, 1);
  for (let i = 0; i < 4; i++) await players[i].page.getByTestId(`quiz-option-${i}`).click();
  for (const p of players) await atQuestion(p.page, 2);

  const late = await newPlayer(browser, 'Esha');
  await joinRoom(late, code);
  await expect(late.page.getByTestId('spectator-banner')).toBeVisible();
  await atQuestion(late.page, 2);
  await expect(late.page.getByTestId('countdown')).toBeVisible();
  await expect(late.page.getByTestId('quiz-option-0')).toBeDisabled();

  for (let i = 0; i < 4; i++) await players[i].page.getByTestId(`quiz-option-${(i + 1) % 4}`).click();
  await atQuestion(late.page, 3);
  await expect(late.page.getByTestId('spectator-banner')).toHaveCount(0);
  await expect(late.page.getByTestId('quiz-option-0')).toBeEnabled();
  await late.page.getByTestId('quiz-option-0').click();
  await expect(late.page.getByTestId('quiz-answered')).toContainText('Locked in');
  for (let i = 0; i < 4; i++) await players[i].page.getByTestId(`quiz-option-${i}`).click();
  await expect(late.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  // Esha only played question 3: her total is at most one question's points.
  const eshaScore = Number(await late.page.locator('[data-testid=standing]', { hasText: 'Esha' }).getByTestId('standing-score').textContent());
  expect(eshaScore).toBeLessThanOrEqual(1000);
  await closeAll([...players, late]);
});
