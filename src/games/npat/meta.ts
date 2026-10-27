import type { GameMeta } from '../meta';

export const NPAT_LABELS: Record<string, string> = { name: 'Name', place: 'Place', animal: 'Animal', thing: 'Thing', movie: 'Movie' };

export const npatMeta: GameMeta = {
  id: 'npat',
  title: 'Name Place Animal Thing',
  emoji: '📝',
  tagline: 'One letter, four answers, beat the clock.',
  minPlayers: 2,
  teams: 'none',
  settings: {
    rounds: { type: 'int', label: 'Rounds (letters)', min: 1, max: 10, default: 3 },
    seconds: { type: 'int', label: 'Writing time', min: 30, max: 180, default: 60, unit: 's', testMin: 5 },
    movie: { type: 'bool', label: 'Add a Movie category', default: false },
  },
  howTo: {
    rules: [
      'Everyone gets the same random letter (never Q, X or Z).',
      'Write a Name, a Place, an Animal and a Thing that start with it (and a Movie, if that category is on).',
      'Your answers stay hidden until the writing ends. Tap Done when you are finished.',
      'Places are checked against the Atlas place database. Other answers stand unless most of the other players reject them in a quick vote.',
    ],
    scoring: ['Valid answer nobody else gave: 10 points.', 'Valid answer someone else also gave: 5 points each.', 'Wrong letter, blank or voted out: 0.'],
    timers: ['60 seconds of writing by default (30–180 s); it ends early when everyone taps Done.', 'The vote lasts 20 seconds and ends early when everyone taps Looks good.'],
  },
  intro: {
    lines: ['Everyone gets the same random letter.', 'Write a Name, Place, Animal and Thing starting with it.', 'Unique answers score 10, shared ones 5. The group votes out fakes.'],
    example: 'Letter M: Meera, Mumbai, Monkey, Mirror. If someone else also wrote Monkey, you each get 5 for it.',
  },
};
