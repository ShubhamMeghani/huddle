'use client';
import type { ComponentType } from 'react';
import type { RoomProps } from '@/client/components/ui';
import { PingGame } from './PingGame';
import { QuizGame } from './QuizGame';
import { DrawGame } from './DrawGame';
import { ImposterGame } from './ImposterGame';
import { AtlasGame } from './AtlasGame';
import { CharadesGame } from './CharadesGame';

export const GAME_COMPONENTS: Record<string, ComponentType<RoomProps>> = {
  ping: PingGame,
  quiz: QuizGame,
  draw: DrawGame,
  imposter: ImposterGame,
  atlas: AtlasGame,
  charades: CharadesGame,
};
