import 'server-only';
import type { FinishedGame } from '@/engine/types';

/** End-of-night awards are computed in Phase 10 (SPEC §4.7). */
export function computeAwards(_games: FinishedGame[]): { award: string; name: string; detail: string }[] {
  return [];
}
