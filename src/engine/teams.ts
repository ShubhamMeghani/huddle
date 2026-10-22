/* Team balancing (SPEC §4.6, R32): snake draft by strength, then improving cross-team swaps. */
import { shuffle } from './rng';
import type { Ctx, Seat, Team } from './types';

export const TEAM_NAMES = ['Team Masala', 'Team Chai', 'Team Mango', 'Team Jalebi'];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function spread(groups: number[][]): number {
  const means = groups.map(mean);
  return Math.max(...means) - Math.min(...means);
}

/** Pure balancing over strengths; returns index groups. Deterministic for a given input order. */
export function balanceIndices(strengths: number[], k: number): number[][] {
  const order = strengths.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const groups: number[][] = Array.from({ length: k }, () => []);
  order.forEach((o, n) => {
    const round = Math.floor(n / k);
    const pos = n % k;
    groups[round % 2 === 0 ? pos : k - 1 - pos].push(o.i);
  });
  const val = (g: number[][]) => spread(g.map((grp) => grp.map((i) => strengths[i])));
  for (let iter = 0; iter < 200; iter++) {
    let best = val(groups);
    let move: [number, number, number, number] | null = null;
    for (let a = 0; a < k; a++)
      for (let b = a + 1; b < k; b++)
        for (let x = 0; x < groups[a].length; x++)
          for (let y = 0; y < groups[b].length; y++) {
            [groups[a][x], groups[b][y]] = [groups[b][y], groups[a][x]];
            const v = val(groups);
            if (v < best - 1e-9) {
              best = v;
              move = [a, x, b, y];
            }
            [groups[a][x], groups[b][y]] = [groups[b][y], groups[a][x]];
          }
    if (!move) break;
    const [a, x, b, y] = move;
    [groups[a][x], groups[b][y]] = [groups[b][y], groups[a][x]];
  }
  return groups;
}

/** Builds `k` teams from seats. Strength = rating for this game (falls back to 1000). */
export function balanceTeams(seats: Seat[], k: number, ratings: Record<string, number>, ctx: Pick<Ctx, 'rng'>, random = false): Team[] {
  const n = Math.max(2, Math.min(k, 4));
  const list = random ? shuffle(ctx.rng, seats) : seats.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const groups = random
    ? Array.from({ length: n }, (_, t) => list.map((_, i) => i).filter((i) => i % n === t))
    : balanceIndices(list.map((s) => ratings[s.id] ?? 1000), n);
  return groups.map((g, t) => ({ id: `t${t + 1}`, name: TEAM_NAMES[t], seatIds: g.map((i) => list[i].id) }));
}
