import { expect, test } from 'vitest';
import { GAME_META } from '@/games/meta';
import { gamesFor, pickForUs } from '@/games/pick';

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

test('AC-92 Pick for us only suggests games whose minimum player count is met', () => {
  expect(pickForUs(1, [])).toBeNull();
  for (let players = 2; players <= 12; players++) {
    const fits = gamesFor(players).map((g) => g.id);
    for (const g of Object.values(GAME_META)) {
      if (g.testOnly) expect(fits).not.toContain(g.id);
      else expect(fits.includes(g.id), `${g.id} at ${players}`).toBe(g.minPlayers <= players);
    }
    for (let i = 0; i < 50; i++) {
      const pick = pickForUs(players, [], () => i / 50)!;
      expect(pick.minPlayers).toBeLessThanOrEqual(players);
      expect(pick.testOnly).toBeFalsy();
    }
  }
  // 2 players: Charades and Imposter (4) and Most Likely To (3) are never picked.
  const two = new Set(Array.from({ length: 100 }, (_, i) => pickForUs(2, [], () => i / 100)!.id));
  for (const id of ['charades', 'imposter', 'mlt']) expect(two.has(id as never)).toBe(false);
});

test('AC-92 Pick for us prefers games not already queued or played tonight, and still picks when every game was', () => {
  const fits = gamesFor(4).map((g) => g.id);
  const avoid = fits.filter((id) => id !== 'atlas');
  for (const r of [0, 0.5, 0.99]) expect(pickForUs(4, avoid, seq(r))!.id).toBe('atlas');
  expect(fits).toContain(pickForUs(4, fits, seq(0.3))!.id);
});
