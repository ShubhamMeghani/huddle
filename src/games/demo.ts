/* Demo presets (R44): short games so one person can try everything against bots. */
import type { GameId } from '@/engine/types';

const ALL_QUIZ = ['bollywood', 'hollywood', 'cricket', 'india_gk', 'world_gk', 'science', 'sports'];

export const DEMO_GAMES: GameId[] = ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt', 'npat', 'emoji'];
export const DEMO_BOTS = ['Bot Priya', 'Bot Rahul', 'Bot Meera', 'Bot Kabir'];

export function demoSettings(id: GameId, testMode: boolean): Record<string, unknown> {
  const t = (normal: number, test: number) => (testMode ? test : normal);
  switch (id) {
    case 'quiz':
      return { questions: t(5, 3), seconds: t(15, 6), categories: ALL_QUIZ, difficulty: 'easy', mode: 'solo' };
    case 'draw':
      return { rounds: 1, drawSeconds: t(40, 6), hints: 2, words: 'mixed' };
    case 'imposter':
      return { rounds: 1, clueRounds: 1, clueSeconds: t(20, 4), discussSeconds: t(20, 4), voteSeconds: t(20, 4), twoImposters: false, imposterKnows: false };
    case 'atlas':
      return { seconds: t(15, 4), lives: 1, variant: 'any' };
    case 'charades':
      return { rounds: 1, seconds: t(45, 6), passes: 1, industries: ['bollywood', 'hollywood'], eras: ['golden', 'modern'], difficulty: 'easy', steal: false };
    case 'mlt':
      return { rounds: t(3, 2), voteSeconds: t(15, 4), selfVote: false };
    case 'npat':
      return { rounds: 1, seconds: t(45, 8), movie: false };
    case 'emoji':
      return { rounds: t(5, 2), seconds: t(20, 6), categories: ['bollywood', 'hollywood', 'countries', 'cities'] };
    default:
      return {};
  }
}
