import { expect, test } from '@playwright/test';
import { closeAll, roomOf, snapshotOf } from './helpers';

test('AC-95 a queued game shows Quick / Normal / Long with estimated minutes; presets apply for everyone; Advanced still edits every setting', async ({ browser }) => {
  const { players } = await roomOf(browser, ['Asha', 'Bilal']);
  const [a, b] = players;
  await a.page.getByTestId('add-quiz').click();
  const item = a.page.getByTestId('queue-item');
  await expect(item).toHaveAttribute('data-preset', 'normal');
  await expect(a.page.getByTestId('preset-0-normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(a.page.getByTestId('queue-estimate-0')).toHaveText('~3 min');
  for (const [n, min] of [['quick', 1], ['normal', 3], ['long', 6]] as const) await expect(a.page.getByTestId(`preset-0-${n}`)).toContainText(`~${min} min`);
  // Only the admin edits; everyone sees the preset and the estimate.
  await expect(b.page.getByTestId('preset-0-quick')).toHaveCount(0);
  await expect(b.page.getByTestId('queue-preset-0')).toHaveText('Normal');

  await a.page.getByTestId('preset-0-quick').click();
  await expect(item).toHaveAttribute('data-preset', 'quick');
  await expect(b.page.getByTestId('queue-preset-0')).toHaveText('Quick');
  await expect(b.page.getByTestId('queue-estimate-0')).toHaveText('~1 min');
  expect((await snapshotOf(b.page)).public.queue[0].settings).toMatchObject({ questions: 5, seconds: 15 });

  // Advanced: the full settings form; a hand-picked timer reads as Custom.
  await expect(a.page.getByTestId('set-0-questions')).toHaveCount(0);
  await a.page.getByTestId('edit-0').click();
  await a.page.getByTestId('set-0-questions').fill('7');
  await a.page.getByTestId('set-0-questions').press('Enter');
  await expect(item).toHaveAttribute('data-preset', 'custom');
  await expect(b.page.getByTestId('queue-preset-0')).toHaveText('Custom');
  await a.page.getByTestId('preset-0-long').click();
  await expect(item).toHaveAttribute('data-preset', 'long');
  await expect(a.page.getByTestId('set-0-questions')).toHaveValue('20');
  await expect(b.page.getByTestId('queue-estimate-0')).toHaveText('~6 min');
  await expect(a.page.getByTestId('queue-total')).toContainText('About 6 min');
  await closeAll(players);
});
