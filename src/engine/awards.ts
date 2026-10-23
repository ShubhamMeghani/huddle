/* End-of-night awards (SPEC §4.7, R52). Pure: computed from the night's finished games. */
import type { FinishedGame } from './types';

export interface Award {
  award: 'MVP' | 'Best Artist' | 'Fastest Finger' | 'Best Imposter' | 'Most AFK';
  emoji: string;
  seatId: string;
  name: string;
  detail: string;
}

interface Acc {
  seatId: string;
  name: string;
  pp: number;
  wins: number;
  drawTurns: number;
  drawerPoints: number;
  quizCorrect: number;
  quizWeightedMs: number;
  imposterWins: number;
  votesReceived: number;
  afkSkips: number;
  missed: number;
}

/** Seats are numbered in join order (s1, s2, …): lower number = earlier join. */
const joinOrder = (seatId: string) => Number(seatId.replace(/\D/g, '')) || 0;

function best<T>(items: T[], better: (a: T, b: T) => number): T | undefined {
  return items.slice().sort(better)[0];
}

export function computeAwards(games: FinishedGame[]): Award[] {
  const acc = new Map<string, Acc>();
  const get = (seatId: string, name: string) => {
    let a = acc.get(seatId);
    if (!a) {
      a = { seatId, name, pp: 0, wins: 0, drawTurns: 0, drawerPoints: 0, quizCorrect: 0, quizWeightedMs: 0, imposterWins: 0, votesReceived: 0, afkSkips: 0, missed: 0 };
      acc.set(seatId, a);
    }
    return a;
  };
  const played = new Set(games.map((g) => g.gameId));
  for (const g of games) {
    for (const r of g.rows) {
      const a = get(r.seatId, r.name);
      a.pp += r.placementPoints;
      if (r.rank === 1 && !g.excludeFromSeason) a.wins += 1;
      const s = r.stats;
      a.drawTurns += s.drawTurns ?? 0;
      a.drawerPoints += s.drawerPoints ?? 0;
      a.quizCorrect += s.quizCorrect ?? 0;
      // Fastest Finger across several quizzes: correct-answer-weighted mean of per-game medians.
      a.quizWeightedMs += (s.quizMedianMs ?? 0) * (s.quizCorrect ?? 0);
      a.imposterWins += s.imposterWins ?? 0;
      a.votesReceived += s.votesReceived ?? 0;
      a.afkSkips += s.afkSkips ?? 0;
      a.missed += s.missed ?? 0;
    }
  }
  const all = [...acc.values()];
  const out: Award[] = [];
  const byJoin = (a: Acc, b: Acc) => joinOrder(a.seatId) - joinOrder(b.seatId);

  const mvp = best(games.some((g) => !g.excludeFromSeason) ? all : [], (a, b) => b.pp - a.pp || b.wins - a.wins || byJoin(a, b));
  if (mvp) out.push({ award: 'MVP', emoji: '🏆', seatId: mvp.seatId, name: mvp.name, detail: `${mvp.pp} placement points` });

  if (played.has('draw')) {
    const artist = best(
      all.filter((a) => a.drawTurns >= 1),
      (a, b) => b.drawerPoints / b.drawTurns - a.drawerPoints / a.drawTurns || b.drawerPoints - a.drawerPoints || byJoin(a, b),
    );
    if (artist) out.push({ award: 'Best Artist', emoji: '🎨', seatId: artist.seatId, name: artist.name, detail: `${Math.round(artist.drawerPoints / artist.drawTurns)} points per drawing` });
  }
  if (played.has('quiz')) {
    const fast = best(
      all.filter((a) => a.quizCorrect >= 5),
      (a, b) => a.quizWeightedMs / a.quizCorrect - b.quizWeightedMs / b.quizCorrect || b.quizCorrect - a.quizCorrect || byJoin(a, b),
    );
    if (fast) out.push({ award: 'Fastest Finger', emoji: '⚡', seatId: fast.seatId, name: fast.name, detail: `${(fast.quizWeightedMs / fast.quizCorrect / 1000).toFixed(1)} s per correct answer` });
  }
  if (played.has('imposter')) {
    const imp = best(
      all.filter((a) => a.imposterWins >= 1),
      (a, b) => b.imposterWins - a.imposterWins || a.votesReceived - b.votesReceived || byJoin(a, b),
    );
    if (imp) out.push({ award: 'Best Imposter', emoji: '🕵️', seatId: imp.seatId, name: imp.name, detail: `${imp.imposterWins} win${imp.imposterWins === 1 ? '' : 's'} as imposter` });
  }
  const afk = best(
    all.filter((a) => a.afkSkips >= 1),
    (a, b) => b.afkSkips - a.afkSkips || b.missed - a.missed || byJoin(a, b),
  );
  if (afk) out.push({ award: 'Most AFK', emoji: '😴', seatId: afk.seatId, name: afk.name, detail: `${afk.afkSkips} turn${afk.afkSkips === 1 ? '' : 's'} skipped` });
  return out;
}
