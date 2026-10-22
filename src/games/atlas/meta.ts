import type { GameMeta } from '../meta';

export const ATLAS_ATTRIBUTION = 'Place data © GeoNames (CC BY 4.0)';

export const atlasMeta: GameMeta = {
  id: 'atlas',
  title: 'Atlas',
  emoji: '🌍',
  tagline: 'Delhi → Indore → England… keep the chain alive.',
  minPlayers: 2,
  teams: 'none',
  settings: {
    seconds: { type: 'int', label: 'Turn timer', min: 10, max: 60, default: 20, unit: 's', testMin: 3 },
    lives: { type: 'int', label: 'Lives', min: 1, max: 3, default: 1 },
    variant: {
      type: 'enum',
      label: 'Places',
      options: [
        { value: 'any', label: 'Anywhere' },
        { value: 'india', label: 'India only' },
        { value: 'countries', label: 'Countries only' },
      ],
      default: 'any',
    },
  },
  howTo: {
    rules: [
      'Name a place that starts with the last letter of the previous place.',
      'Countries, capitals, Indian states and cities, and big world cities all count. Old names like Bombay work too.',
      'Each place can be used once per game.',
      'If the game doesn’t know your place, the others vote to accept it.',
      'Run out of time and you lose a life. Lose them all and you’re out. Last one standing wins.',
      ATLAS_ATTRIBUTION,
    ],
    scoring: ['+10 for every accepted place.', '+50 for the last player standing.'],
    timers: ['20 seconds per turn by default (10–60 s).', 'An accept vote lasts 10 seconds and pauses the turn timer.'],
  },
};
