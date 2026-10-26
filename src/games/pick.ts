/* "Pick for us" (R96): suggests a game that the players in the room can actually start. */
import { GAME_META, type GameMeta } from './meta';

/** Games whose minimum player count is met (test-only games never count). */
export function gamesFor(players: number): GameMeta[] {
  return Object.values(GAME_META).filter((g) => !g.testOnly && g.minPlayers <= players);
}

/** A random fitting game, preferring ones not already queued or played tonight. Null when none fits. */
export function pickForUs(players: number, avoid: string[], rng: () => number = Math.random): GameMeta | null {
  const fits = gamesFor(players);
  if (!fits.length) return null;
  const fresh = fits.filter((g) => !avoid.includes(g.id));
  const pool = fresh.length ? fresh : fits;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
