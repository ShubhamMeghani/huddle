/* Crew rankings and stats (R49, R50). Pure functions over recorded result rows. */

export interface ResultRow {
  gameId: string; // games.id (one game)
  gameType: string;
  endedAt: number; // epoch ms
  excludeFromSeason: boolean;
  identityId: string;
  name: string;
  rank: number;
  score: number;
  placementPoints: number;
  stats: Record<string, number>;
}

/** Season key: calendar month in IST (decision Q1), e.g. "2026-10". */
export function seasonOf(ms: number): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date(ms));
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
}

export interface Standing {
  identityId: string;
  name: string;
  points: number;
  games: number;
  wins: number;
  average: number;
  rank: number;
}

/** Season leaderboard: total placement points, then wins, then average, then name. Ties share a rank. */
export function seasonLeaderboard(rows: ResultRow[], season: string, members?: Set<string>): Standing[] {
  const map = new Map<string, Standing>();
  for (const r of rows) {
    if (r.excludeFromSeason || seasonOf(r.endedAt) !== season) continue;
    if (members && !members.has(r.identityId)) continue;
    const s = map.get(r.identityId) ?? { identityId: r.identityId, name: r.name, points: 0, games: 0, wins: 0, average: 0, rank: 0 };
    s.points += r.placementPoints;
    s.games += 1;
    if (r.rank === 1) s.wins += 1;
    s.name = r.name;
    map.set(r.identityId, s);
  }
  const list = [...map.values()].map((s) => ({ ...s, points: Math.round(s.points), average: Math.round(s.points / s.games) }));
  list.sort((a, b) => b.points - a.points || b.wins - a.wins || b.average - a.average || a.name.localeCompare(b.name));
  return list.map((s) => ({ ...s, rank: 1 + list.filter((x) => x.points > s.points || (x.points === s.points && x.wins > s.wins)).length }));
}

export function seasonsIn(rows: ResultRow[]): string[] {
  return [...new Set(rows.filter((r) => !r.excludeFromSeason).map((r) => seasonOf(r.endedAt)))].sort().reverse();
}

export interface GameStats {
  gameType: string;
  played: number;
  wins: number;
  averageRank: number;
  extra: Record<string, number>;
}

/** Per-member, per-game stats (R50). */
export function perGameStats(rows: ResultRow[], identityId: string): GameStats[] {
  const byType = new Map<string, ResultRow[]>();
  for (const r of rows) if (r.identityId === identityId) byType.set(r.gameType, [...(byType.get(r.gameType) ?? []), r]);
  return [...byType].map(([gameType, list]) => {
    const sum = (k: string) => list.reduce((a, r) => a + (r.stats[k] ?? 0), 0);
    const extra: Record<string, number> = {};
    if (gameType === 'quiz') extra.accuracy = sum('quizAnswered') ? Math.round((100 * sum('quizCorrect')) / sum('quizAnswered')) : 0;
    if (gameType === 'draw') extra.avgDrawerPoints = sum('drawTurns') ? Math.round(sum('drawerPoints') / sum('drawTurns')) : 0;
    if (gameType === 'atlas') extra.placesNamed = sum('placesNamed');
    if (gameType === 'imposter') extra.imposterWinRate = sum('imposterRounds') ? Math.round((100 * sum('imposterWins')) / sum('imposterRounds')) : 0;
    if (gameType === 'charades') extra.actedGuessed = sum('actedGuessed');
    if (gameType === 'mlt') extra.votesReceived = sum('mltVotes');
    return {
      gameType,
      played: list.length,
      wins: list.filter((r) => r.rank === 1).length,
      averageRank: Math.round((10 * list.reduce((a, r) => a + r.rank, 0)) / list.length) / 10,
      extra,
    };
  });
}

/** Head-to-head between two members: games together and who placed higher (R50). */
export function headToHead(rows: ResultRow[], a: string, b: string): { together: number; aAhead: number; bAhead: number; tied: number } {
  const games = new Map<string, { a?: number; b?: number }>();
  for (const r of rows) {
    if (r.identityId !== a && r.identityId !== b) continue;
    const g = games.get(r.gameId) ?? {};
    if (r.identityId === a) g.a = r.rank;
    else g.b = r.rank;
    games.set(r.gameId, g);
  }
  const out = { together: 0, aAhead: 0, bAhead: 0, tied: 0 };
  for (const g of games.values()) {
    if (g.a === undefined || g.b === undefined) continue;
    out.together++;
    if (g.a < g.b) out.aAhead++;
    else if (g.b < g.a) out.bAhead++;
    else out.tied++;
  }
  return out;
}
