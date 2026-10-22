/* Multiplayer Elo (SPEC §4.6, R33). Every pair (i, j) is a mini-match:
 *   E_ij = 1 / (1 + 10^((R_j − R_i)/400)),  S_ij ∈ {1, ½, 0} from ranks,
 *   ΔR_i = (K / (n − 1)) · Σ_j (S_ij − E_ij),  K = 32. With two players this is classic Elo. */

export const K = 32;
export const START_RATING = 1000;

export function eloDeltas(ratings: number[], ranks: number[], k = K): number[] {
  const n = ratings.length;
  if (n < 2) return ratings.map(() => 0);
  return ratings.map((ri, i) => {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const e = 1 / (1 + 10 ** ((ratings[j] - ri) / 400));
      const s = ranks[i] < ranks[j] ? 1 : ranks[i] === ranks[j] ? 0.5 : 0;
      sum += s - e;
    }
    return (k / (n - 1)) * sum;
  });
}

/** Strength used for team balancing: this game's rating, else the mean of other game ratings, else 1000. */
export function strengthFor(byGame: Record<string, number> | undefined, gameId: string | null): number {
  if (!byGame) return START_RATING;
  if (gameId && byGame[gameId] !== undefined) return byGame[gameId];
  const vals = Object.values(byGame);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : START_RATING;
}
