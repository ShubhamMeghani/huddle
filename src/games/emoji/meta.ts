import type { GameMeta } from '../meta';

export const EMOJI_CATEGORIES = [
  { value: 'bollywood', label: 'Bollywood movies' },
  { value: 'hollywood', label: 'Hollywood movies' },
  { value: 'countries', label: 'Countries' },
  { value: 'cities', label: 'Cities (India and world)' },
];

export const EMOJI_CATEGORY_LABEL: Record<string, string> = {
  bollywood: 'Bollywood movie',
  hollywood: 'Hollywood movie',
  country: 'Country',
  city_india: 'Indian city',
  city_world: 'World city',
};

export const emojiMeta: GameMeta = {
  id: 'emoji',
  title: 'Emoji Decode',
  emoji: '🧩',
  tagline: 'Movies and places, spelled in emoji.',
  minPlayers: 2,
  teams: 'none',
  settings: {
    rounds: { type: 'int', label: 'Puzzles', min: 5, max: 30, default: 10, testMin: 1 },
    seconds: { type: 'int', label: 'Timer per puzzle', min: 10, max: 45, default: 30, unit: 's', testMin: 3 },
    categories: { type: 'multi', label: 'Categories', options: EMOJI_CATEGORIES, default: EMOJI_CATEGORIES.map((c) => c.value), minSelected: 1 },
  },
  howTo: {
    rules: [
      'Everyone sees the same row of emoji and what kind of answer it is (a movie, a country or a city).',
      'Type your answer. Wrong guesses cost nothing, so keep trying until the timer ends.',
      'Small typos are fine, and places accept their other names: Bombay counts for Mumbai.',
      'The puzzle ends when time runs out or everyone has solved it, then the answer is revealed.',
    ],
    scoring: ['Correct: 500 points plus a speed bonus of up to 500 (faster = more).', 'No answer: 0.'],
    timers: ['30 seconds per puzzle by default (10–45 s).', 'The answer shows for 5 seconds before the next puzzle.'],
  },
  intro: {
    lines: ['Everyone sees the same emoji puzzle.', 'Type the movie, country or city it spells. Keep guessing.', 'Right answers score more the faster you get them.'],
    example: '🚢🧊💔 is a Hollywood movie: type “Titanic”. 🎬🌊🚆 is a city: “Mumbai” or “Bombay” both count.',
  },
};
