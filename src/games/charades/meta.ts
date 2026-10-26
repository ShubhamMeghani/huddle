import type { GameMeta } from '../meta';

export const charadesMeta: GameMeta = {
  id: 'charades',
  title: 'Dumb Charades',
  emoji: '🎭',
  tagline: 'Act it out. No talking!',
  minPlayers: 4,
  teams: 'required',
  settings: {
    rounds: { type: 'int', label: 'Rounds', min: 1, max: 5, default: 3 },
    seconds: { type: 'int', label: 'Team timer', min: 30, max: 180, default: 90, unit: 's', testMin: 5 },
    passes: { type: 'int', label: 'Passes per turn', min: 0, max: 3, default: 1 },
    industries: {
      type: 'multi',
      label: 'Movies',
      options: [
        { value: 'bollywood', label: 'Bollywood' },
        { value: 'hollywood', label: 'Hollywood' },
      ],
      default: ['bollywood', 'hollywood'],
      minSelected: 1,
    },
    eras: {
      type: 'multi',
      label: 'Eras',
      options: [
        { value: 'classic', label: 'Classic (before 1990)' },
        { value: 'golden', label: '1990–2009' },
        { value: 'modern', label: '2010 onwards' },
      ],
      default: ['classic', 'golden', 'modern'],
      minSelected: 1,
    },
    difficulty: {
      type: 'enum',
      label: 'Difficulty',
      options: [
        { value: 'any', label: 'Any' },
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
      ],
      default: 'any',
    },
    steal: { type: 'bool', label: 'Steal rule', default: false },
  },
  howTo: {
    rules: [
      'Teams take turns. Each turn one teammate is the actor and only they see the movie title on their phone.',
      'Act it out without speaking while your team shouts guesses.',
      'The actor taps Guessed when the team gets it, or Pass for a new title (1 pass per turn by default).',
      'Steal rule (optional): if time runs out, the other teams get 15 seconds to steal it.',
    ],
    scoring: ['Guessed: 10 points plus 1 for every full 10 seconds left.', 'A successful steal: 5 points to the stealing team.'],
    timers: ['90 seconds per team turn by default (30–180 s).', 'Steal window: 15 seconds.'],
  },
  intro: {
    lines: ['Each turn, one actor sees a secret movie title.', 'Act it out without speaking while your team guesses.', 'The actor taps Guessed when the team gets it.'],
    example: 'The actor sees “Sholay”, mimes a horse ride and a coin toss, and the team shouts it with 50 s left → 15 points.',
  },
};
