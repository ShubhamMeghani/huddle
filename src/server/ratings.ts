import 'server-only';
import type { Tx } from './db';
import type { FinishedGame } from '@/engine/types';

/** Ratings are added in Phase 3 (multiplayer Elo). */
export async function recordRatings(_c: Tx, _g: FinishedGame): Promise<void> {}
