/* Quiz Clash rules (R56–R61). Server/engine only: imports the bank with answers, never shipped to clients. */
import bankJson from '../../../content/quiz.json';
import { activeSeats, award, finishGame, seatById, seatWaiting, setPhase, turnMissed } from '@/engine/core';
import { shuffle } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import type { GameModule } from '../types';

export interface Question {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: number;
}

export const BANK = bankJson as Question[];
const BY_ID = new Map(BANK.map((q) => [q.id, q]));

export interface QuizSettings {
  questions: number;
  seconds: number;
  categories: string[];
  difficulty: string;
  mode: 'solo' | 'teams';
}

interface QuizState {
  ids: string[];
  idx: number;
  durationMs: number;
  answers: Record<SeatId, { choice: number; ms: number }>;
  reveal: { correct: number; dist: number[]; points: Record<SeatId, number> } | null;
  stats: Record<SeatId, { correct: number; answered: number; times: number[] }>;
  teams: boolean;
}

export const REVEAL_MS = 5000;
const st = (room: RoomState) => room.game!.state as QuizState;

/** Picks questions for the settings, avoiding ones used in this room or excluded by reports (R60, R61). */
export function selectQuestions(
  settings: Pick<QuizSettings, 'questions' | 'categories' | 'difficulty'>,
  used: Set<string>,
  excluded: Set<string>,
  rng: () => number,
  bank: Question[] = BANK,
): string[] {
  const pool = bank.filter(
    (q) => settings.categories.includes(q.category) && (settings.difficulty === 'any' || q.difficulty === settings.difficulty) && !excluded.has(q.id),
  );
  const fresh = shuffle(rng, pool.filter((q) => !used.has(q.id)));
  const stale = shuffle(rng, pool.filter((q) => used.has(q.id)));
  return [...fresh, ...stale].slice(0, settings.questions).map((q) => q.id);
}

/** Correct: 500 + up to 500 for speed (linear in time remaining). Wrong or missing: 0. */
export function pointsFor(correct: boolean, ms: number, durationMs: number): number {
  if (!correct) return 0;
  const remaining = Math.max(0, Math.min(durationMs, durationMs - ms));
  return 500 + Math.round((500 * remaining) / durationMs);
}

function startQuestion(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx); // late joiners play from the next question (R9)
  s.answers = {};
  s.reveal = null;
  setPhase(room, 'question', s.durationMs, ctx);
}

function reveal(room: RoomState, ctx: Ctx) {
  const s = st(room);
  const q = BY_ID.get(s.ids[s.idx])!;
  const dist = [0, 0, 0, 0];
  const points: Record<SeatId, number> = {};
  for (const [seatId, a] of Object.entries(s.answers)) {
    dist[a.choice] += 1;
    const ok = a.choice === q.answer;
    points[seatId] = pointsFor(ok, a.ms, s.durationMs);
    const stat = (s.stats[seatId] ??= { correct: 0, answered: 0, times: [] });
    stat.answered += 1;
    if (ok) {
      stat.correct += 1;
      stat.times.push(a.ms);
    }
  }
  for (const seat of activeSeats(room)) if (!s.answers[seat.id]) turnMissed(room, seat.id, ctx);
  if (s.teams && room.teams) {
    // Team mode (R59): each team gets the average of its members' points for this question.
    for (const t of room.teams) {
      const members = t.seatIds.filter((id) => seatById(room, id)?.status === 'seated');
      if (!members.length) continue;
      const avg = Math.round(members.reduce((sum, id) => sum + (points[id] ?? 0), 0) / members.length);
      award(room, { teamId: t.id }, avg, `quiz q${s.idx + 1}`);
    }
    for (const [id, p] of Object.entries(points)) {
      const seat = seatById(room, id);
      if (seat) seat.score += p; // personal tally for stats only
    }
  } else {
    for (const [id, p] of Object.entries(points)) award(room, { seatId: id }, p, `quiz q${s.idx + 1}`);
  }
  s.reveal = { correct: q.answer, dist, points };
  setPhase(room, 'reveal', ctx.testMode ? 8000 : REVEAL_MS, ctx); // longer in test mode so loaded CI phones can assert it
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
}

function stats(room: RoomState) {
  const s = st(room);
  return Object.fromEntries(
    Object.entries(s.stats).map(([id, v]) => [id, { quizCorrect: v.correct, quizAnswered: v.answered, quizMedianMs: median(v.times) }]),
  );
}

export const quiz: GameModule = {
  id: 'quiz',
  start(room, ctx) {
    const set = room.game!.settings as unknown as QuizSettings;
    room.memory ??= {};
    const used = new Set<string>((room.memory.quizUsed as string[] | undefined) ?? []);
    const ids = selectQuestions(set, used, new Set(ctx.excludedQuestions ?? []), ctx.rng);
    if (!ids.length) throw new GameError('INVALID', 'No questions match those categories');
    room.memory.quizUsed = [...new Set([...used, ...ids])];
    const state: QuizState = {
      ids,
      idx: 0,
      durationMs: set.seconds * 1000,
      answers: {},
      reveal: null,
      stats: {},
      teams: set.mode === 'teams' && Boolean(room.teams?.length),
    };
    room.game!.state = state;
    startQuestion(room, ctx);
  },
  act(room, seat, action, ctx) {
    if (action.type !== 'answer') throw new GameError('INVALID');
    const s = st(room);
    if (room.phase.kind !== 'question') throw new GameError('WRONG_PHASE');
    const choice = Number(action.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new GameError('INVALID');
    if (s.answers[seat.id]) throw new GameError('INVALID', 'Answer already locked in'); // first tap is final (Q7)
    s.answers[seat.id] = { choice, ms: ctx.now - room.phase.startedAt };
    if (activeSeats(room).every((x) => s.answers[x.id])) reveal(room, ctx);
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'question') return reveal(room, ctx);
    if (room.phase.kind === 'reveal') {
      if (s.idx + 1 >= s.ids.length) return finishGame(room, ctx, stats(room));
      s.idx += 1;
      return startQuestion(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    const q = BY_ID.get(s.ids[s.idx])!;
    return {
      idx: s.idx,
      total: s.ids.length,
      questionId: q.id,
      category: q.category,
      question: q.question,
      options: q.options,
      answeredSeatIds: Object.keys(s.answers),
      teams: s.teams,
      // The correct option only exists in the view during the reveal (R34).
      reveal: room.phase.kind === 'reveal' ? s.reveal : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const mine = s.answers[seat.id];
    return { mustAct: room.phase.kind === 'question' && !mine && seat.status === 'seated', myChoice: mine?.choice ?? null };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (room.phase.kind !== 'question' || s.answers[seat.id]) return null;
    const q = BY_ID.get(s.ids[s.idx])!;
    const right = ctx.rng() < 0.6;
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
    const choice = right ? q.answer : wrong[Math.floor(ctx.rng() * 3)];
    const delayMs = Math.round(Math.min(s.durationMs * 0.8, 1500 + ctx.rng() * 6000));
    return { delayMs, action: { type: 'answer', choice } };
  },
  stats,
};
