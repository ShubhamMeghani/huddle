import type { GameMeta } from '../meta';

export const mltMeta: GameMeta = {
  id: 'mlt',
  title: 'Most Likely To',
  emoji: '👀',
  tagline: 'Anonymous votes. Dramatic reveals.',
  minPlayers: 3,
  teams: 'none',
  settings: {
    rounds: { type: 'int', label: 'Prompts', min: 3, max: 20, default: 8, testMin: 1 },
    voteSeconds: { type: 'int', label: 'Vote timer', min: 10, max: 60, default: 20, unit: 's', testMin: 3 },
    selfVote: { type: 'bool', label: 'Allow voting for yourself', default: false },
  },
  howTo: {
    rules: [
      'A prompt appears, like "Most likely to be late to their own wedding".',
      'Everyone secretly votes for one player.',
      'Votes are anonymous: nobody, not even the app, keeps who voted for whom.',
      'The totals are revealed one by one, from fewest votes to most.',
    ],
    scoring: ['Just for fun: nobody earns season points.', 'Night stats show who collected the most votes.'],
    timers: ['20 seconds to vote by default (10–60 s).', 'The reveal plays for about 6 seconds.'],
  },
  intro: {
    lines: ['A prompt appears on every phone.', 'Everyone secretly votes for one player.', 'Totals are revealed from fewest votes to most. Just for fun.'],
    example: '“Most likely to miss their own flight” → Rahul 3 votes, Meera 1.',
  },
};
