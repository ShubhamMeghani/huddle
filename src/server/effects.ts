import 'server-only';
import type { Tx } from './db';
import type { Effect, FinishedGame, RoomState } from '@/engine/types';
import { recordRatings } from './ratings';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dateIST(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Persists a finished game exactly once (unique room_id + game_no), R45. Bots have no identity rows. */
export async function recordGame(c: Tx, room: RoomState, g: FinishedGame): Promise<string | null> {
  const ins = await c.query(
    `insert into games (room_id, crew_id, game_no, game_type, settings, started_at, ended_at)
     values ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0))
     on conflict (room_id, game_no) do nothing returning id`,
    [room.roomId, room.crewId, g.gameNo, g.gameId, JSON.stringify(g.settings), g.startedAt, g.endedAt],
  );
  if (!ins.rowCount) return null;
  const gameId = ins.rows[0].id as string;
  for (const r of g.rows) {
    if (!UUID.test(r.identityId)) continue;
    await c.query(
      `insert into game_results (game_id, identity_id, display_name, team, rank, score, placement_points, stats)
       select $1, $2, $3, $4, $5, $6, $7, $8 where exists (select 1 from identities where id = $2)
       on conflict do nothing`,
      [gameId, r.identityId, r.name, r.teamId, r.rank, Math.round(r.score), r.placementPoints, JSON.stringify(r.stats)],
    );
  }
  await recordRatings(c, g);
  return gameId;
}

export async function recordNight(c: Tx, room: RoomState): Promise<void> {
  const summary = {
    games: room.finished.map((g) => ({
      gameNo: g.gameNo,
      gameId: g.gameId,
      winners: g.rows.filter((r) => r.rank === 1).map((r) => r.name),
      rows: g.rows.map(({ identityId: _i, ...r }) => r),
    })),
  };
  const { computeAwards } = await import('./awards');
  const awards = computeAwards(room.finished);
  await c.query(
    `insert into nights (room_id, crew_id, date_ist, awards, summary, updated_at) values ($1, $2, $3, $4, $5, now())
     on conflict (room_id) do update set crew_id = excluded.crew_id, awards = excluded.awards, summary = excluded.summary, updated_at = now()`,
    [room.roomId, room.crewId, dateIST(room.createdAt), JSON.stringify(awards), JSON.stringify(summary)],
  );
}

/** Side effects produced by the pure engine, persisted inside the same transaction. */
export async function applyEffects(c: Tx, room: RoomState, effects: Effect[]): Promise<void> {
  for (const e of effects) {
    switch (e.type) {
      case 'gameEnded':
        await recordGame(c, room, e.game);
        await recordNight(c, room);
        break;
      case 'nightUpdated':
        await recordNight(c, room);
        break;
      case 'clearStrokes':
        await c.query('delete from strokes where room_id = $1 and turn_id = $2', [room.roomId, e.turnId]);
        break;
      case 'strokes':
        await c.query('insert into strokes (room_id, turn_id, seq, ops) values ($1, $2, $3, $4) on conflict do nothing', [
          room.roomId,
          e.turnId,
          e.seq,
          JSON.stringify(e.ops),
        ]);
        break;
      case 'placeSuggestion':
        await c.query('insert into place_suggestions (name_normalized, room_id, accepted) values ($1, $2, $3)', [e.name, room.roomId, e.accepted]);
        break;
      default:
        break;
    }
  }
}
