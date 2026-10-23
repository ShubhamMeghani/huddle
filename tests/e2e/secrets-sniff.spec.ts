import { expect, test, type Page } from '@playwright/test';
import { act, closeAll, drawQueue, findDrawer, roomOf, snapshotOf, startGame, type Player } from './helpers';

/** Every HTTP response body and realtime frame a phone received, with the time it arrived. */
interface Capture {
  at: number;
  text: string;
}

function capture(p: Player): () => Promise<Capture[]> {
  const http: Capture[] = [];
  p.page.on('response', async (r) => {
    if (r.url().includes('/api/realtime/stream')) return;
    try {
      http.push({ at: Date.now(), text: (await r.text()).toLowerCase() });
    } catch {}
  });
  return async () => {
    const frames = await p.page.evaluate(() => (window as unknown as { __huddleLog?: string[] }).__huddleLog ?? []);
    return [
      ...http,
      ...frames.map((f) => {
        const i = f.indexOf(' ');
        return { at: Number(f.slice(0, i)), text: f.slice(i + 1).toLowerCase() };
      }),
    ];
  };
}

const quoted = (s: string) => JSON.stringify(s.toLowerCase());
/**
 * What a phone held before the reveal: captured before the reveal showed on the admin's phone and not itself a reveal
 * state. (A loaded phone can paint a frame well after it arrives, so arrival time alone would count reveal frames.)
 */
const REVEALED = /"kind":"(reveal|turnend)"/;
const before = (caps: Capture[], t: number) => caps.filter((c) => c.at < t && !REVEALED.test(c.text));

async function waitFor(page: Page, testId: string, timeout = 60_000) {
  await expect(page.getByTestId(testId)).toBeVisible({ timeout });
  return Date.now();
}

test('AC-39 network sniffing: no phone receives a secret it may not see before its reveal (Quiz, Charades, Draw, Imposter, Most Likely To)', async ({ browser }) => {
  test.setTimeout(300_000);
  const { players } = await roomOf(browser, ['Asha', 'Bilal', 'Charu', 'Dev']);
  const caps = players.map((p) => capture(p));
  const [a] = players;
  const all = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];

  // Quiz: nobody may see which option is correct before the reveal.
  await startGame(a.page, [{ gameId: 'quiz', settings: { questions: 1, seconds: 20, categories: all, difficulty: 'any', mode: 'solo' } }]);
  await Promise.all(players.map((p, i) => p.page.getByTestId(`quiz-option-${i}`).click()));
  const quizReveal = await waitFor(a.page, 'quiz-reveal');
  for (const c of caps) for (const x of before(await c(), quizReveal)) expect(x.text).not.toContain('"reveal":{"correct"');
  await waitFor(a.page, 'break', 30_000);

  // Draw: the word and the choices reach only the drawer (no one guesses, so nobody else is entitled).
  await act(a.page, 'start', { queue: drawQueue(1, 5, 2) });
  const drawer = await findDrawer(players);
  const choices = await drawer.page.getByTestId('draw-choices').locator('button').allTextContents();
  await drawer.page.getByTestId('draw-choice-0').click();
  const drawReveal = await waitFor(a.page, 'draw-reveal', 30_000);
  for (const [i, p] of players.entries()) {
    if (p === drawer) continue;
    for (const x of before(await caps[i](), drawReveal)) for (const w of choices) expect(x.text, `${p.name} saw ${w}`).not.toContain(quoted(w.trim()));
  }
  await act(a.page, 'endGame');

  // Charades: only the actor sees the title before the reveal.
  await act(a.page, 'setTeams', { mode: 'shuffle', count: 2 });
  await act(a.page, 'start', { queue: [{ gameId: 'charades', settings: { rounds: 1, seconds: 30, passes: 0, industries: ['bollywood'], eras: ['modern'], difficulty: 'any', steal: false } }] });
  let actor: Player | undefined;
  await expect.poll(async () => {
    for (const p of players) if (await p.page.getByTestId('charades-actor').isVisible()) actor = p;
    return Boolean(actor);
  }).toBe(true);
  const title = (await actor!.page.getByTestId('charades-title').textContent())!;
  await actor!.page.getByTestId('charades-guessed').click();
  const charadesReveal = await waitFor(a.page, 'charades-reveal');
  for (const [i, p] of players.entries()) {
    if (p === actor) continue;
    for (const x of before(await caps[i](), charadesReveal)) expect(x.text, `${p.name} saw the title`).not.toContain(quoted(title));
  }
  await act(a.page, 'endGame');

  // Imposter: each phone sees only its own word; nobody learns who the imposter is before the reveal.
  await act(a.page, 'start', { queue: [{ gameId: 'imposter', settings: { rounds: 1, clueRounds: 1, clueSeconds: 15, discussSeconds: 15, voteSeconds: 15, twoImposters: false, imposterKnows: false } }] });
  const words = await Promise.all(players.map((p) => p.page.getByTestId('imposter-word').textContent()));
  const distinct = [...new Set(words.map((w) => w!.trim()))];
  expect(distinct).toHaveLength(2);
  await act(a.page, 'endGame');
  const endAt = Date.now();
  for (const [i, p] of players.entries()) {
    const other = distinct.find((w) => w !== words[i]!.trim())!;
    for (const x of before(await caps[i](), endAt - 500)) {
      expect(x.text, `${p.name} saw the other word`).not.toContain(quoted(other));
      expect(x.text).not.toContain('"imposters":');
    }
  }

  // Most Likely To: who voted for whom never travels at all.
  await act(a.page, 'start', { queue: [{ gameId: 'mlt', settings: { rounds: 1, voteSeconds: 20, selfVote: false } }] });
  const seats = (await snapshotOf(a.page)).public.seats as { id: string; name: string }[];
  await Promise.all(players.map((p, i) => p.page.locator(`[data-testid=mlt-vote-for][data-seat-id=${seats[(i + 1) % 4].id}]`).click()));
  await waitFor(a.page, 'mlt-reveal');
  for (const c of caps) for (const x of await c()) for (const s of seats) for (const t of seats) expect(x.text).not.toContain(`"${s.id}":"${t.id}"`);
  await closeAll(players);
});
