import { expect, test } from '@playwright/test';
import { act, chooseWord, closeAll, drawQueue, roomOf, startGame } from './helpers';

test('AC-42 the leaderboard button is on every game; it shows scores, teams and the timer without pausing anyone; answering still works afterwards', async ({ browser }) => {
  test.setTimeout(180_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  const [a, b] = players;
  await act(a.page, 'setTeams', { mode: 'shuffle', count: 2 });
  const all = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];
  await startGame(a.page, [
    { gameId: 'quiz', settings: { questions: 2, seconds: 30, categories: all, difficulty: 'any', mode: 'teams' } },
    { gameId: 'draw', settings: { rounds: 1, drawSeconds: 30, hints: 0, words: 'mixed' } },
    { gameId: 'imposter', settings: { rounds: 1, clueRounds: 1, clueSeconds: 30, discussSeconds: 30, voteSeconds: 30, twoImposters: false, imposterKnows: false } },
    { gameId: 'atlas', settings: { seconds: 30, lives: 1, variant: 'any' } },
    { gameId: 'charades', settings: { rounds: 1, seconds: 60, passes: 1, industries: ['bollywood'], eras: ['modern'], difficulty: 'any', steal: false } },
    { gameId: 'mlt', settings: { rounds: 1, voteSeconds: 30, selfVote: false } },
  ]);

  // Quiz: open during a question.
  await expect(b.page.getByTestId('quiz-question')).toBeVisible();
  const aBefore = Number(await a.page.getByTestId('countdown').getAttribute('data-seconds'));
  await b.page.getByTestId('leaderboard-open').click();
  const lb = b.page.getByTestId('leaderboard');
  await expect(lb.getByTestId('lb-row')).toHaveCount(4);
  await expect(lb.getByTestId('lb-team')).toHaveCount(2);
  await expect(lb.getByTestId('countdown')).toBeVisible();
  await b.page.waitForTimeout(2200);
  expect(Number(await a.page.getByTestId('countdown').getAttribute('data-seconds'))).toBeLessThan(aBefore); // others not paused
  await b.page.getByTestId('leaderboard-close').click();
  await b.page.getByTestId('quiz-option-0').click();
  await expect(b.page.getByTestId('quiz-answered')).toContainText('Locked in');

  // Every other game shows the button too.
  for (const id of ['draw', 'imposter', 'atlas', 'charades', 'mlt']) {
    // A game nobody plays can end by itself (Draw skips each unchosen turn), so end it through the sync client and
    // accept "already over"; the admin menu's End game is covered by AC-29.
    const end = await act(a.page, 'endGame');
    expect(end.ok || end.code === 'WRONG_PHASE', JSON.stringify(end)).toBe(true);
    await expect(a.page.getByTestId('break')).toBeVisible();
    await a.page.getByTestId('continue').click();
    await expect(a.page.getByTestId('playing')).toHaveAttribute('data-game', id);
    for (const p of players) await expect(p.page.getByTestId('leaderboard-open')).toBeVisible();
  }
  await closeAll(players);
});

test('AC-42 in Draw, typed text survives the overlay, and the overlay closes by itself when the player becomes the drawer', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  await startGame(a.page, drawQueue(1, 5, 0));
  await chooseWord(a.page); // Asha draws first
  await b.page.getByTestId('guess-input').fill('half a thought');
  await b.page.getByTestId('leaderboard-open').click();
  await expect(b.page.getByTestId('leaderboard')).toBeVisible();
  await b.page.getByTestId('leaderboard-close').click();
  await expect(b.page.getByTestId('guess-input')).toHaveValue('half a thought');
  await b.page.getByTestId('leaderboard-open').click();
  // Asha's 5 s turn ends; Bilal becomes the drawer and must act: the overlay gets out of the way.
  await expect(b.page.getByTestId('draw-choices')).toBeVisible({ timeout: 20_000 });
  await expect(b.page.getByTestId('leaderboard')).toHaveCount(0);
  await closeAll(players);
});

