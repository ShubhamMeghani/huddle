/* Drives any game to the end with bots, calling `inspect` after every step. */
import { joinRoom } from '@/engine/room';
import { GAME_META } from '@/games/meta';
import { defaultsOf } from '@/games/settings';
import type { GameId, RoomState } from '@/engine/types';
import { harness, startQueue, touchAll, type Harness } from './engine';

export const GAMES: GameId[] = ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt'];

/** Fast settings per game so a full game runs in a few hundred steps. */
export function fastSettings(id: GameId): Record<string, unknown> {
  const d = defaultsOf(GAME_META[id].settings);
  switch (id) {
    case 'quiz':
      return { ...d, questions: 3, seconds: 10 };
    case 'draw':
      return { ...d, rounds: 1, drawSeconds: 30 };
    case 'imposter':
      return { ...d, rounds: 1, clueRounds: 1, clueSeconds: 15, discussSeconds: 20, voteSeconds: 15 };
    case 'atlas':
      return { ...d, seconds: 10, lives: 1 };
    case 'charades':
      return { ...d, rounds: 1, seconds: 30 };
    case 'mlt':
      return { ...d, rounds: 3, voteSeconds: 10 };
    default:
      return d;
  }
}

/** One human admin plus bots (total `players`). Teams are set for team games. */
export function botRoom(id: GameId, players = 5, seed = `drive-${id}`): Harness {
  const h = harness(['Host'], { seed, bots: Array.from({ length: players - 1 }, (_, i) => `Bot${i + 1}`) });
  if (GAME_META[id].teams === 'required') h.act('Host', { type: 'setTeams', mode: 'shuffle', count: 2 });
  startQueue(h, [{ gameId: id, settings: fastSettings(id) }]);
  return h;
}

export function drive(h: Harness, inspect: (room: RoomState, step: number) => void, maxSteps = 4000): number {
  let step = 0;
  inspect(h.room, step);
  while (h.room.status === 'playing' && step < maxSteps) {
    step++;
    h.clock.advance(700);
    touchAll(h);
    h.tick();
    inspect(h.room, step);
  }
  if (h.room.status === 'playing') throw new Error(`game did not finish in ${maxSteps} steps`);
  return step;
}

/** "Leave and rejoin": the seat's presence goes stale, then the same identity joins again. */
export function leaveAndRejoin(h: Harness, seatName: string) {
  const s = h.seat(seatName);
  delete h.presence[s.identityId];
  h.presence[s.identityId] = h.clock.now;
  joinRoom(h.room, { identityIds: [s.identityId], identityId: s.identityId, name: s.name }, h.ctx());
}
