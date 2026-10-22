import type { GameMeta } from '../meta';

export const imposterMeta: GameMeta = {
  id: 'imposter',
  title: 'Imposter',
  emoji: '🕵️',
  tagline: 'Everyone has the same word. Almost.',
  minPlayers: 4,
  teams: 'none',
  settings: {
    rounds: { type: 'int', label: 'Rounds', min: 1, max: 5, default: 3 },
    clueRounds: { type: 'int', label: 'Clue rounds', min: 1, max: 3, default: 2 },
    clueSeconds: { type: 'int', label: 'Clue timer', min: 15, max: 60, default: 30, unit: 's', testMin: 3 },
    discussSeconds: { type: 'int', label: 'Discussion', min: 20, max: 180, default: 60, unit: 's', testMin: 3 },
    voteSeconds: { type: 'int', label: 'Vote timer', min: 15, max: 60, default: 30, unit: 's', testMin: 3 },
    twoImposters: { type: 'bool', label: 'Two imposters with 8+ players', default: false },
    imposterKnows: { type: 'bool', label: 'Imposter knows they are the imposter', default: false },
  },
  howTo: {
    rules: [
      'Everyone gets the same secret word, except the imposter, who gets a similar one.',
      'By default the imposter is not told. Watch the clues to work out if it is you!',
      'Take turns giving a one-word clue. It cannot contain your own word.',
      'Discuss, then vote for who you think the imposter is. A tie gets one revote.',
      'If the imposter is caught, they get one guess at the crew’s word to steal the win.',
    ],
    scoring: [
      'Crew wins: +100 for every crew member.',
      '+50 for every crew member who voted for the imposter.',
      'Imposter survives: +300. Imposter steals with a correct guess: +200.',
    ],
    timers: [
      'Clue: 30 s per turn. Discussion: 60 s (ends early when everyone taps Ready).',
      'Vote: 30 s; revote: 20 s; imposter’s guess: 30 s.',
    ],
  },
};
