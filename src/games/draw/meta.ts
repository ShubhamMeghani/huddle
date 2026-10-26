import type { GameMeta } from '../meta';

export const drawMeta: GameMeta = {
  id: 'draw',
  title: 'Draw & Guess',
  emoji: '🎨',
  tagline: 'Sketch it, guess it, India edition.',
  minPlayers: 2,
  teams: 'none',
  settings: {
    rounds: { type: 'int', label: 'Rounds', min: 1, max: 5, default: 2 },
    drawSeconds: { type: 'int', label: 'Drawing time', min: 30, max: 120, default: 80, unit: 's', testMin: 5 },
    hints: { type: 'int', label: 'Letter hints', min: 0, max: 3, default: 2 },
    words: {
      type: 'enum',
      label: 'Words',
      options: [
        { value: 'mixed', label: 'Everything' },
        { value: 'india', label: 'India special' },
      ],
      default: 'mixed',
    },
  },
  howTo: {
    rules: [
      'Each round, everyone takes a turn to draw.',
      'The drawer picks 1 of 3 words and draws it. Everyone else types guesses in the chat.',
      'Close guesses get a private "You’re close!".',
      'Once you guess right, your messages are only seen by the drawer and others who got it.',
      'Letter hints appear as time runs out.',
    ],
    scoring: [
      'Correct guess: 50 points plus up to 250 for speed.',
      'Drawer: 60 points for every player who guesses the word.',
    ],
    timers: [
      'The drawer has 15 seconds to pick a word, or the turn is skipped.',
      'Drawing time is 80 seconds by default (30–120 s). The turn ends early when everyone has guessed.',
    ],
  },
  intro: {
    lines: ['One player draws a secret word.', 'Everyone else types guesses. Near misses get a “You’re close!”.', 'Fast guesses score more, and the artist scores for each one.'],
    example: 'Priya draws “auto rickshaw”. You type “auto” (close!), then “auto rickshaw” → correct.',
  },
};
