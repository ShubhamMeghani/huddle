import { expect, test } from 'vitest';
import type { RoomState } from '@/engine/types';
import { botRoom, drive, GAMES, leaveAndRejoin } from '../helpers/drive';

/** What a rejoin must never change (the skribbl.io regression). */
function essentials(room: RoomState) {
  return JSON.stringify({
    seats: room.seats.map((s) => ({ id: s.id, identity: s.identityId, score: s.score, team: s.teamId, status: s.status })),
    teams: room.teams,
    teamScores: room.teamScores,
    game: room.game,
    phase: room.phase,
    finished: room.finished,
  });
}

for (const id of GAMES) {
  test(`AC-18 ${id}: leaving and rejoining 5 times at every phase changes no score, team, turn order or night total`, () => {
    const h = botRoom(id, 5);
    let checks = 0;
    drive(h, (room) => {
      const before = essentials(room);
      for (let i = 0; i < 5; i++) leaveAndRejoin(h, 'Host');
      expect(essentials(room)).toBe(before);
      checks++;
    });
    expect(checks).toBeGreaterThan(5);
  });
}
