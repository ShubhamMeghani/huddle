import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { roomOp, requireSeat } from '@/server/rooms';
import { applyAction } from '@/engine/room';
import { GameError } from '@/engine/types';
import type { Identity } from '@/server/identity';
import { loadRoom, roomWith } from '../helpers/unit-room';

function wave(code: string, who: Identity, actionId = randomUUID()) {
  return roomOp(
    code,
    who,
    (room, ctx) => {
      applyAction(room, requireSeat(room, who), { type: 'wave' }, ctx);
      return { waves: room.waves };
    },
    { actionId, type: 'wave' },
  );
}

describe('room pipeline', () => {
  test('AC-14 the same actionId is applied once and both responses are identical', async () => {
    const { code, ids } = await roomWith(['A', 'B']);
    const before = await loadRoom(code);
    const actionId = randomUUID();
    const r1 = await wave(code, ids[0], actionId);
    const r2 = await wave(code, ids[0], actionId);
    expect(r2.replayed).toBe(true);
    expect(r2.result).toEqual(r1.result);
    const after = await loadRoom(code);
    expect(after.version).toBe(before.version + 1);
    expect(after.state.waves).toBe(1);
  });

  test('AC-14 20 concurrent distinct actions raise the version by exactly 20 with no lost updates', async () => {
    const { code, ids } = await roomWith(['A', 'B', 'C', 'D']);
    const before = await loadRoom(code);
    await Promise.all(Array.from({ length: 20 }, (_, i) => wave(code, ids[i % ids.length])));
    const after = await loadRoom(code);
    expect(after.version).toBe(before.version + 20);
    expect(after.state.waves).toBe(20);
    expect(after.state.v).toBe(after.version);
  });

  test('AC-14 two concurrent submissions for the same Atlas turn: exactly one is accepted', async () => {
    const { code, ids } = await roomWith(['A', 'B', 'C']);
    await roomOp(code, ids[0], (room, ctx) => {
      applyAction(room, requireSeat(room, ids[0]), { type: 'start', queue: [{ gameId: 'atlas', settings: { seconds: 30, lives: 1, variant: 'any' } }] }, ctx);
      (room.game!.state as { letter: string }).letter = 'd';
      return null;
    });
    const submit = (text: string) =>
      roomOp(
        code,
        ids[0],
        (room, ctx) => {
          applyAction(room, requireSeat(room, ids[0]), { type: 'submit', text }, ctx);
          return null;
        },
        { actionId: randomUUID(), type: 'submit' },
      ).then(
        () => 'ok',
        (e: GameError) => e.code,
      );
    const results = await Promise.all([submit('Delhi'), submit('Dhaka')]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'NOT_YOUR_TURN')).toHaveLength(1);
    const after = await loadRoom(code);
    expect((after.state.game!.state as { chain: unknown[] }).chain).toHaveLength(1);
  });

  test('invalid actions change nothing and report a code', async () => {
    const { code, ids } = await roomWith(['A']);
    const before = await loadRoom(code);
    await expect(
      roomOp(code, ids[0], (room, ctx) => applyAction(room, requireSeat(room, ids[0]), { type: 'nonsense' }, ctx)),
    ).rejects.toBeInstanceOf(GameError);
    const after = await loadRoom(code);
    expect(after.version).toBe(before.version);
    expect(after.state).toEqual(before.state);
  });

  test('unknown room codes report ROOM_NOT_FOUND', async () => {
    await expect(roomOp('ZZZQ', null, () => null)).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });
});
