import type { GameMeta } from '../meta';

export const truthsMeta: GameMeta = {
  id: 'truths',
  title: 'Two Truths & a Lie',
  emoji: '🤥',
  tagline: 'Three facts about you. One is fake.',
  minPlayers: 3,
  teams: 'none',
  settings: {
    writeSeconds: { type: 'int', label: 'Writing time', min: 60, max: 240, default: 120, unit: 's', testMin: 5 },
    voteSeconds: { type: 'int', label: 'Vote timer', min: 10, max: 60, default: 25, unit: 's', testMin: 3 },
  },
  howTo: {
    rules: [
      'Everyone writes three statements about themselves: two true, one lie, and marks the lie.',
      'Nobody sees your statements until your turn, and then they appear in a shuffled order.',
      'On each player’s turn, everyone else votes for the statement they think is the lie.',
      'The lie and the votes are revealed after each turn.',
    ],
    scoring: ['Spot the lie: +100.', 'Fool someone: +50 to the author for every player who picked a truth.'],
    timers: ['2 minutes to write by default (60–240 s); it ends early when everyone has submitted.', '25 seconds to vote on each player (10–60 s), then a 6-second reveal.'],
  },
  intro: {
    lines: ['Write three things about yourself: two true, one lie.', 'On your turn, everyone else votes for the lie.', 'Spot a lie for 100 points; fool someone for 50.'],
    example: '“I’ve met Sachin”, “I can’t swim”, “I’ve been to Ladakh”. Two friends pick “I can’t swim”, but the lie was Sachin → you get +100.',
  },
};
