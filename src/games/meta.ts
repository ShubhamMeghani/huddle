/* Game metadata shared by client and server: titles, players, teams, settings and How-to-play (R42). */
import type { GameId } from '@/engine/types';
import type { SettingsSpec } from './settings';
import { quizMeta } from './quiz/meta';
import { drawMeta } from './draw/meta';
import { imposterMeta } from './imposter/meta';
import { atlasMeta } from './atlas/meta';
import { charadesMeta } from './charades/meta';
import { mltMeta } from './mlt/meta';
import { emojiMeta } from './emoji/meta';
import { npatMeta } from './npat/meta';

export interface HowTo {
  rules: string[];
  scoring: string[];
  timers: string[];
}

/** The card shown before a game's first round in a room (R95): three short lines and one example. */
export interface Intro {
  lines: [string, string, string];
  example: string;
}

export interface GameMeta {
  id: GameId;
  title: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  teams: 'none' | 'required' | 'optional';
  testOnly?: boolean;
  settings: SettingsSpec;
  howTo: HowTo;
  intro?: Intro;
}

const ping: GameMeta = {
  id: 'ping',
  title: 'Ping',
  emoji: '🏓',
  tagline: 'Engine test game',
  minPlayers: 1,
  teams: 'none',
  testOnly: true,
  settings: {
    mode: {
      type: 'enum',
      label: 'Mode',
      options: [
        { value: 'turns', label: 'Turns' },
        { value: 'all', label: 'Everyone at once' },
      ],
      default: 'turns',
    },
    rounds: { type: 'int', label: 'Rounds', min: 1, max: 5, default: 2 },
    turnSeconds: { type: 'int', label: 'Turn timer', min: 5, max: 60, default: 10, unit: 's', testMin: 2 },
  },
  howTo: {
    rules: ['On your turn, tap Ping.'],
    scoring: ['Each ping scores 10 points.'],
    timers: ['Each turn has a timer; missing it skips your turn.'],
  },
};

export const GAME_META: Record<string, GameMeta> = { quiz: quizMeta, draw: drawMeta, imposter: imposterMeta, atlas: atlasMeta, charades: charadesMeta, mlt: mltMeta, npat: npatMeta, emoji: emojiMeta, ping };

export function metaOf(id: GameId): GameMeta {
  const m = GAME_META[id];
  if (!m) throw new Error(`Unknown game ${id}`);
  return m;
}
