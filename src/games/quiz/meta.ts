import type { GameMeta } from '../meta';

export const QUIZ_CATEGORIES = [
  { value: 'bollywood', label: 'Bollywood' },
  { value: 'hollywood', label: 'Hollywood' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'india_gk', label: 'India GK' },
  { value: 'world_gk', label: 'World GK' },
  { value: 'science', label: 'Science' },
  { value: 'sports', label: 'Sports' },
];

export const quizMeta: GameMeta = {
  id: 'quiz',
  title: 'Quiz Clash',
  emoji: '⚡',
  tagline: 'Fast fingers win. Bollywood to science.',
  minPlayers: 2,
  teams: 'optional',
  settings: {
    questions: { type: 'int', label: 'Questions', min: 5, max: 30, default: 10, testMin: 1 },
    seconds: { type: 'int', label: 'Timer per question', min: 10, max: 30, default: 20, unit: 's', testMin: 2 },
    categories: { type: 'multi', label: 'Categories', options: QUIZ_CATEGORIES, default: QUIZ_CATEGORIES.map((c) => c.value), minSelected: 1 },
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
    mode: {
      type: 'enum',
      label: 'Play as',
      options: [
        { value: 'solo', label: 'Everyone for themselves' },
        { value: 'teams', label: 'Teams' },
      ],
      default: 'solo',
    },
  },
  howTo: {
    rules: [
      'Everyone sees the same question with four options.',
      'Tap one answer. Your first tap is locked in.',
      'The question ends when time runs out or everyone has answered, then the answer is revealed.',
      'Spotted a wrong question? Tap "Report question" on the reveal screen.',
    ],
    scoring: [
      'Correct: 500 points plus a speed bonus of up to 500 (faster = more).',
      'Wrong or no answer: 0.',
      'In team mode, each question adds the average of your team members’ points.',
    ],
    timers: ['Each question has a timer (20 s by default, 10–30 s).', 'The reveal shows for 5 seconds before the next question.'],
  },
};
