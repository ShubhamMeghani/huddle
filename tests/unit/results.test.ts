import { expect, test } from 'vitest';
import { q, tx } from '@/server/db';
import { recordGame } from '@/server/effects';
import { loadRoom, roomWith } from '../helpers/unit-room';
import type { FinishedGame } from '@/engine/types';

test('AC-48 a finished game writes one games row and one result per participant, exactly once', async () => {
  const { code, ids } = await roomWith(['A', 'B', 'C']);
  const { state } = await loadRoom(code);
  const g: FinishedGame = {
    gameNo: 1,
    gameId: 'ping',
    settings: { mode: 'all' },
    startedAt: Date.now() - 60_000,
    endedAt: Date.now(),
    teamGame: false,
    rows: ids.map((id, i) => ({
      seatId: `s${i + 1}`,
      identityId: id.id,
      name: id.name,
      teamId: null,
      score: 30 - i * 10,
      rank: i + 1,
      placementPoints: [100, 50, 0][i],
      stats: { pings: 3 - i },
    })),
  };
  g.rows.push({ seatId: 'bot', identityId: 'bot-x', name: 'Bot', teamId: null, score: 0, rank: 4, placementPoints: 0, stats: {} });
  const first = await tx((c) => recordGame(c, state, g));
  const second = await tx((c) => recordGame(c, state, g));
  expect(first).toBeTruthy();
  expect(second).toBeNull();
  const games = await q('select id from games where room_id = $1', [state.roomId]);
  expect(games).toHaveLength(1);
  const rows = await q('select display_name, rank, score, placement_points, stats from game_results where game_id = $1 order by rank', [games[0].id]);
  expect(rows.map((r) => r.display_name)).toEqual(['A', 'B', 'C']);
  expect(rows.map((r) => Number(r.placement_points))).toEqual([100, 50, 0]);
  expect(rows[0].stats).toEqual({ pings: 3 });
});
