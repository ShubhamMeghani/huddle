/* Draw & Guess rules (R67–R75). The word list stays server-side; clients only ever see the mask. */
import wordsJson from '../../../content/draw-words.json';
import botDrawingsJson from '../../../content/bot-drawings.json';
import { activeSeats, addNotice, award, finishGame, seatById, seatWaiting, setPhase, skipIfAfk, turnMissed } from '@/engine/core';
import { pick, shuffle } from '@/engine/rng';
import { GameError, type Ctx, type RoomState, type SeatId } from '@/engine/types';
import { fold, isClose } from '@/lib/text';
import type { StrokeOp } from '@/lib/strokes';
import type { GameModule } from '../types';

export interface DrawWord {
  word: string;
  difficulty: string;
  tags: string[];
}
export const WORDS = wordsJson as DrawWord[];
export const BOT_DRAWINGS = botDrawingsJson as { word: string; ops: StrokeOp[] }[];
const BOT_WORDS = new Set(BOT_DRAWINGS.map((d) => d.word));

export const CHOOSE_MS = 15_000;
export const TURN_END_MS = 4_000;
export const DRAWER_POINTS = 60;

export interface Msg {
  id: number;
  seatId: SeatId | null;
  text: string | null;
  kind: 'guess' | 'correct' | 'system';
}

export interface DrawState {
  round: number;
  rounds: number;
  order: SeatId[];
  turnIdx: number;
  turnNo: number;
  turnId: string;
  drawerId: SeatId | null;
  choices: string[];
  word: string | null;
  drawMs: number;
  drawEndsAt: number | null;
  hintTimes: number[];
  revealed: number[];
  maxHints: number;
  guessed: { seatId: SeatId; points: number }[];
  chat: Msg[];
  secretChat: Msg[];
  msgCounter: number;
  usedWords: string[];
  pack: 'mixed' | 'india';
  botProgress: number;
  lastWord: string | null;
  stats: Record<SeatId, { drawTurns: number; drawerPoints: number; correctGuesses: number }>;
}

const st = (room: RoomState) => room.game!.state as DrawState;

export function guesserPoints(remainingMs: number, drawMs: number): number {
  return 50 + Math.round((250 * Math.max(0, Math.min(drawMs, remainingMs))) / drawMs);
}

/** Hint times as fractions of the drawing time (R73). */
export function hintFractions(n: number): number[] {
  return [[], [0.5], [0.5, 0.75], [0.25, 0.5, 0.75]][Math.max(0, Math.min(3, n))];
}

export function letterIndices(word: string): number[] {
  return [...word].map((ch, i) => (/[a-z]/i.test(ch) ? i : -1)).filter((i) => i >= 0);
}

/** Never more than half of the letters are revealed. */
export function maxReveals(word: string): number {
  return Math.floor(letterIndices(word).length / 2);
}

export function maskOf(word: string, revealed: number[]): string[] {
  return [...word].map((ch, i) => (ch === ' ' ? ' ' : ch === '-' ? '-' : revealed.includes(i) ? ch.toUpperCase() : '_'));
}

function stat(s: DrawState, id: SeatId) {
  return (s.stats[id] ??= { drawTurns: 0, drawerPoints: 0, correctGuesses: 0 });
}

function post(s: DrawState, list: 'chat' | 'secretChat', msg: Omit<Msg, 'id'>) {
  s.msgCounter += 1;
  s[list].push({ id: s.msgCounter, ...msg });
  if (s[list].length > 50) s[list].splice(0, s[list].length - 50);
}

function beginRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  s.order = room.seats.filter((x) => x.status === 'seated').map((x) => x.id);
  s.turnIdx = -1;
  nextTurn(room, ctx);
}

function nextTurn(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (;;) {
    s.turnIdx += 1;
    if (s.turnIdx >= s.order.length) {
      if (s.round >= s.rounds) return finishGame(room, ctx, s.stats);
      s.round += 1;
      return beginRound(room, ctx);
    }
    const id = s.order[s.turnIdx];
    if (seatById(room, id)?.status !== 'seated') continue;
    if (skipIfAfk(room, id)) continue; // AFK drawers are skipped immediately (R21)
    return startTurn(room, id, ctx);
  }
}

function pickChoices(room: RoomState, s: DrawState, drawerIsBot: boolean, rng: () => number): string[] {
  const pool = WORDS.filter((w) => (s.pack === 'india' ? w.tags.includes('india') : true)).map((w) => w.word);
  const fresh = pool.filter((w) => !s.usedWords.includes(w));
  const source = fresh.length >= 3 ? fresh : pool;
  const choices = shuffle(rng, source).slice(0, 3);
  if (drawerIsBot && !choices.some((w) => BOT_WORDS.has(w))) choices[0] = pick(rng, [...BOT_WORDS]);
  return choices;
}

function startTurn(room: RoomState, drawerId: SeatId, ctx: Ctx) {
  const s = st(room);
  s.turnNo += 1;
  s.turnId = `${room.game!.gameNo}.${s.turnNo}`;
  s.drawerId = drawerId;
  s.word = null;
  s.guessed = [];
  s.revealed = [];
  s.chat = [];
  s.secretChat = [];
  s.lastWord = null;
  s.botProgress = 0;
  s.drawEndsAt = null;
  s.choices = pickChoices(room, s, Boolean(seatById(room, drawerId)?.isBot), ctx.rng);
  setPhase(room, 'choose', ctx.testMode ? 4_000 : CHOOSE_MS, ctx, drawerId);
}

function beginDrawing(room: RoomState, ctx: Ctx) {
  const s = st(room);
  s.drawEndsAt = ctx.now + s.drawMs;
  s.hintTimes = hintFractions(s.maxHints).map((f) => ctx.now + Math.round(f * s.drawMs));
  s.usedWords.push(s.word!);
  stat(s, s.drawerId!).drawTurns += 1;
  setPhase(room, 'draw', s.drawMs, ctx, s.drawerId);
  room.phase.endsAt = s.drawEndsAt;
  room.phase.deadline = nextDrawWake(s);
}

function nextDrawWake(s: DrawState): number {
  const next = s.hintTimes.find((t) => t < s.drawEndsAt!);
  return next ?? s.drawEndsAt!;
}

function revealHint(s: DrawState, rng: () => number) {
  const word = s.word!;
  if (s.revealed.length >= maxReveals(word)) return;
  const options = letterIndices(word).filter((i) => !s.revealed.includes(i));
  if (options.length) s.revealed.push(pick(rng, options));
}

function endTurn(room: RoomState, ctx: Ctx) {
  const s = st(room);
  s.lastWord = s.word;
  post(s, 'chat', { seatId: null, text: `The word was ${s.word}`, kind: 'system' });
  setPhase(room, 'turnEnd', ctx.testMode ? 2_500 : TURN_END_MS, ctx);
}

function allGuessed(room: RoomState, s: DrawState): boolean {
  const guessers = activeSeats(room).filter((x) => x.id !== s.drawerId);
  return guessers.length > 0 && guessers.every((x) => s.guessed.some((g) => g.seatId === x.id));
}

export const draw: GameModule = {
  id: 'draw',
  chatActions: ['guess'],
  start(room, ctx) {
    const set = room.game!.settings as { rounds: number; drawSeconds: number; hints: number; words: 'mixed' | 'india' };
    room.memory ??= {};
    const state: DrawState = {
      round: 1,
      rounds: set.rounds,
      order: [],
      turnIdx: -1,
      turnNo: 0,
      turnId: '',
      drawerId: null,
      choices: [],
      word: null,
      drawMs: set.drawSeconds * 1000,
      drawEndsAt: null,
      hintTimes: [],
      revealed: [],
      maxHints: set.hints,
      guessed: [],
      chat: [],
      secretChat: [],
      msgCounter: 0,
      usedWords: [...((room.memory.drawUsed as string[] | undefined) ?? [])].slice(-300),
      pack: set.words,
      botProgress: 0,
      lastWord: null,
      stats: {},
    };
    room.game!.state = state;
    beginRound(room, ctx);
  },
  act(room, seat, action, ctx) {
    const s = st(room);
    switch (action.type) {
      case 'choose': {
        if (room.phase.kind !== 'choose') throw new GameError('WRONG_PHASE');
        if (seat.id !== s.drawerId) throw new GameError('NOT_YOUR_TURN');
        const i = Number(action.index);
        if (!Number.isInteger(i) || i < 0 || i >= s.choices.length) throw new GameError('INVALID');
        s.word = s.choices[i];
        room.memory.drawUsed = [...((room.memory.drawUsed as string[] | undefined) ?? []), s.word].slice(-300);
        return beginDrawing(room, ctx);
      }
      case 'guess': {
        if (room.phase.kind !== 'draw') throw new GameError('WRONG_PHASE');
        const text = typeof action.text === 'string' ? action.text.trim().slice(0, 40) : '';
        if (!text) throw new GameError('INVALID');
        if (seat.id === s.drawerId) throw new GameError('INVALID', 'The drawer can’t chat while drawing'); // R74
        if (s.guessed.some((g) => g.seatId === seat.id)) {
          post(s, 'secretChat', { seatId: seat.id, text, kind: 'guess' }); // only drawer + correct guessers see it
          return;
        }
        if (fold(text) === fold(s.word!)) {
          const points = guesserPoints((s.drawEndsAt ?? ctx.now) - ctx.now, s.drawMs);
          s.guessed.push({ seatId: seat.id, points });
          award(room, { seatId: seat.id }, points, 'guessed');
          award(room, { seatId: s.drawerId! }, DRAWER_POINTS, 'drawer bonus');
          stat(s, seat.id).correctGuesses += 1;
          stat(s, s.drawerId!).drawerPoints += DRAWER_POINTS;
          post(s, 'chat', { seatId: seat.id, text: null, kind: 'correct' }); // "<name> guessed it!" without the text
          ctx.private = { correct: true, points };
          if (allGuessed(room, s)) endTurn(room, ctx);
          return;
        }
        post(s, 'chat', { seatId: seat.id, text, kind: 'guess' });
        if (isClose(text, s.word!)) ctx.private = { close: true }; // only the guesser is told (R72)
        return;
      }
      case 'botStroke': {
        if (!seat.isBot || seat.id !== s.drawerId || room.phase.kind !== 'draw') throw new GameError('INVALID');
        const drawing = BOT_DRAWINGS.find((d) => d.word === s.word);
        if (!drawing || s.botProgress >= drawing.ops.length) throw new GameError('INVALID');
        ctx.effects.push({ type: 'strokes', turnId: s.turnId, seq: s.botProgress, ops: [drawing.ops[s.botProgress]] });
        s.botProgress += 1;
        return;
      }
      default:
        throw new GameError('INVALID');
    }
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'choose') {
      if (s.drawerId) turnMissed(room, s.drawerId, ctx); // no word picked: the turn is skipped (R68)
      return nextTurn(room, ctx);
    }
    if (room.phase.kind === 'draw') {
      if (s.drawEndsAt != null && ctx.now < s.drawEndsAt) {
        revealHint(s, ctx.rng);
        s.hintTimes = s.hintTimes.filter((t) => t > ctx.now);
        room.phase.deadline = nextDrawWake(s);
        return;
      }
      return endTurn(room, ctx);
    }
    if (room.phase.kind === 'turnEnd') return nextTurn(room, ctx);
  },
  shiftTimes(room, ms) {
    const s = st(room);
    if (s.drawEndsAt != null) s.drawEndsAt += ms;
    s.hintTimes = s.hintTimes.map((t) => t + ms);
  },
  publicView(room) {
    const s = st(room);
    const showWord = room.phase.kind === 'turnEnd';
    return {
      round: s.round,
      rounds: s.rounds,
      drawerId: s.drawerId,
      turnId: s.turnId,
      mask: s.word ? maskOf(s.word, s.revealed) : [],
      guessedIds: s.guessed.map((g) => g.seatId),
      chat: s.chat.slice(-30),
      lastWord: showWord ? s.lastWord : null,
    };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    if (seat.id === s.drawerId) {
      return {
        mustAct: room.phase.kind === 'choose' || room.phase.kind === 'draw',
        drawer: true,
        choices: room.phase.kind === 'choose' ? s.choices : [],
        word: s.word,
        secretChat: s.secretChat.slice(-30),
      };
    }
    if (s.guessed.some((g) => g.seatId === seat.id)) {
      return { mustAct: false, drawer: false, guessed: true, word: s.word, secretChat: s.secretChat.slice(-30) };
    }
    return { mustAct: false, drawer: false, guessed: false };
  },
  bot(room, seat, ctx) {
    const s = st(room);
    if (seat.id === s.drawerId) {
      if (room.phase.kind === 'choose') {
        const i = Math.max(0, s.choices.findIndex((w) => BOT_WORDS.has(w)));
        return { delayMs: 1500, action: { type: 'choose', index: i } };
      }
      const drawing = BOT_DRAWINGS.find((d) => d.word === s.word);
      if (room.phase.kind === 'draw' && drawing && s.botProgress < drawing.ops.length) return { delayMs: 700, action: { type: 'botStroke' } };
      return null;
    }
    if (room.phase.kind !== 'draw' || s.guessed.some((g) => g.seatId === seat.id) || !s.word) return null;
    const delayMs = 3000 + Math.round(ctx.rng() * 5000);
    const elapsed = ctx.now + delayMs - ((s.drawEndsAt ?? ctx.now) - s.drawMs);
    const right = ctx.rng() < Math.min(0.9, (elapsed / s.drawMs) * 1.4);
    const text = right ? s.word : pick(ctx.rng, WORDS).word;
    return { delayMs, action: { type: 'guess', text } };
  },
  seatRemoved(room, seatId, ctx) {
    const s = st(room);
    if (s.drawerId === seatId && (room.phase.kind === 'choose' || room.phase.kind === 'draw')) {
      addNotice(room, 'The drawer left, so the turn ends', ctx);
      if (room.phase.kind === 'draw') endTurn(room, ctx);
      else nextTurn(room, ctx);
    }
  },
  stats(room) {
    return st(room).stats;
  },
};
