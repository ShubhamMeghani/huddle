import { expect, test } from '@playwright/test';
import { closeAll, joinRoom, newPlayer, quizQueue, startGame } from './helpers';

test('AC-50 create a crew, join by invite, play a crew-linked night; the crew history shows it with date, game, winner and awards', async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await newPlayer(browser, 'Asha');
  const b = await newPlayer(browser, 'Bilal');
  await a.page.goto('/');
  await expect(a.page.getByTestId('home')).toHaveAttribute('data-ready', 'true');
  await a.page.getByTestId('name-input').fill('Asha');
  await a.page.getByTestId('crew-new').click();
  await a.page.getByTestId('crew-name').fill('Hostel 4B');
  await a.page.getByTestId('crew-create').click();
  await expect(a.page.getByTestId('crew-title')).toHaveText('Hostel 4B');
  const invite = await a.page.getByTestId('crew-invite-link').inputValue();

  await b.page.goto(invite);
  await expect(b.page.getByTestId('crew-invite')).toHaveAttribute('data-ready', 'true');
  await b.page.getByTestId('crew-join-name').fill('Bilal');
  await b.page.getByTestId('crew-join').click();
  await expect(b.page.getByTestId('crew-title')).toHaveText('Hostel 4B');
  const crewUrl = b.page.url();

  await a.page.getByTestId('crew-start-night').click();
  const code = (await a.page.getByTestId('room-code').textContent())!.trim();
  await joinRoom(b, code);
  await startGame(a.page, quizQueue(1, 10));
  await a.page.getByTestId('quiz-option-0').click();
  await b.page.getByTestId('quiz-option-1').click();
  await expect(a.page.getByTestId('break')).toBeVisible({ timeout: 30_000 });
  await a.page.getByTestId('end-night').click();
  await expect(a.page.getByTestId('night-summary')).toBeVisible();
  await expect(a.page.getByTestId('award').first()).toBeVisible(); // at least MVP
  const winner = (await a.page.getByTestId('night-game').first().textContent())!.replace(/.*winner\s*/, '').trim();

  await b.page.goto(crewUrl);
  await expect(b.page.getByTestId('crew-night')).toHaveCount(1, { timeout: 15_000 });
  const night = b.page.getByTestId('crew-night').first();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  await expect(night.getByTestId('night-date')).toHaveText(today);
  await expect(night).toContainText('Quiz Clash');
  await expect(night).toContainText(winner);
  await expect(night.getByTestId('night-awards')).toContainText('MVP');
  await expect(b.page.getByTestId('leaderboard-row')).toHaveCount(2);
  await closeAll([a, b]);
});
