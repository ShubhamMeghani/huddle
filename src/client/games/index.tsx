'use client';
import type { ComponentType } from 'react';
import type { RoomProps } from '@/client/components/ui';
import { PingGame } from './PingGame';
import { QuizGame } from './QuizGame';

export const GAME_COMPONENTS: Record<string, ComponentType<RoomProps>> = {
  ping: PingGame,
  quiz: QuizGame,
};
