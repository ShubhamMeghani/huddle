/* Server/engine-side registry of pure game modules. */
import type { GameId } from '@/engine/types';
import type { GameModule } from './types';
import { ping } from './ping/rules';
import { quiz } from './quiz/rules';
import { draw } from './draw/rules';
import { imposter } from './imposter/rules';

const MODULES: Partial<Record<GameId, GameModule>> = { ping, quiz, draw, imposter };

export function moduleOf(id: GameId): GameModule {
  const m = MODULES[id];
  if (!m) throw new Error(`No module for ${id}`);
  return m;
}

export function hasModule(id: string): id is GameId {
  return id in MODULES;
}
