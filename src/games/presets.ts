/* Quick / Normal / Long presets and estimated durations (R97). Normal is each game's defaults; the presets only
 * change round counts and timers, so categories and house rules picked under Advanced are kept. */
import { metaOf } from './meta';
import { defaultsOf } from './settings';
import type { GameId } from '@/engine/types';

export type PresetName = 'quick' | 'normal' | 'long';
export const PRESET_NAMES: PresetName[] = ['quick', 'normal', 'long'];
export const PRESET_LABELS: Record<PresetName, string> = { quick: 'Quick', normal: 'Normal', long: 'Long' };

type S = Record<string, number>;
interface GamePresets {
  quick: S;
  long: S;
  /** Rough seconds for these settings and this many players: timers rarely run to the end. */
  seconds: (s: S, players: number) => number;
}

const PRESETS: Partial<Record<GameId, GamePresets>> = {
  quiz: {
    quick: { questions: 5, seconds: 15 },
    long: { questions: 20, seconds: 20 },
    seconds: (s) => s.questions * (0.6 * s.seconds + 5),
  },
  draw: {
    quick: { rounds: 1, drawSeconds: 60 },
    long: { rounds: 3, drawSeconds: 100 },
    seconds: (s, n) => s.rounds * n * (6 + 0.8 * s.drawSeconds + 4),
  },
  imposter: {
    quick: { rounds: 1, clueRounds: 1 },
    long: { rounds: 5, clueRounds: 2 },
    seconds: (s, n) => s.rounds * (s.clueRounds * n * 0.5 * s.clueSeconds + 0.7 * s.discussSeconds + 0.6 * s.voteSeconds + 15),
  },
  atlas: {
    quick: { seconds: 15, lives: 1 },
    long: { seconds: 30, lives: 3 },
    // Each player lasts about six turns per life, answering in under half the timer.
    seconds: (s, n) => n * s.lives * 6 * 0.4 * s.seconds,
  },
  charades: {
    quick: { rounds: 1, seconds: 60 },
    long: { rounds: 5, seconds: 120 },
    seconds: (s) => s.rounds * 2 * (0.8 * s.seconds + 5),
  },
  mlt: {
    quick: { rounds: 5 },
    long: { rounds: 15 },
    seconds: (s) => s.rounds * (0.6 * s.voteSeconds + 10), // about 6 s of reveal plus the next prompt
  },
  npat: {
    quick: { rounds: 2, seconds: 45 },
    long: { rounds: 5, seconds: 90 },
    seconds: (s) => s.rounds * (0.9 * s.seconds + 15 + 7),
  },
};

export function hasPresets(id: GameId): boolean {
  return Boolean(PRESETS[id]);
}

/** The preset's values for the fields it controls. Normal = the defaults of those same fields. */
export function presetValues(id: GameId, name: PresetName): S {
  const p = PRESETS[id];
  if (!p) return {};
  const defaults = defaultsOf(metaOf(id).settings) as S;
  if (name !== 'normal') return p[name];
  return Object.fromEntries(Object.keys(p.quick).map((k) => [k, defaults[k]]));
}

/** Settings with a preset applied on top of the current ones. */
export function applyPreset(id: GameId, settings: Record<string, unknown>, name: PresetName): Record<string, unknown> {
  return { ...settings, ...presetValues(id, name) };
}

/** Which preset these settings match, or null for custom timers and rounds. */
export function presetOf(id: GameId, settings: Record<string, unknown>): PresetName | null {
  return PRESET_NAMES.find((n) => Object.entries(presetValues(id, n)).every(([k, v]) => settings[k] === v)) ?? null;
}

/** Estimated minutes for these settings, rounded to a whole minute (at least 1). */
export function estimateMinutes(id: GameId, settings: Record<string, unknown>, players: number): number {
  const p = PRESETS[id];
  if (!p) return 1;
  const s = { ...(defaultsOf(metaOf(id).settings) as S), ...(settings as S) };
  return Math.max(1, Math.round(p.seconds(s, Math.max(players, metaOf(id).minPlayers)) / 60));
}
