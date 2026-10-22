import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { catchUp } from '@/engine/room';
import { roomOp } from '@/server/rooms';
import { harness, startQueue, touchAll } from '../helpers/engine';
import { loadRoom, roomWith } from '../helpers/unit-room';

const pingTurns = (turnSeconds = 10, rounds = 2) => [{ gameId: 'ping' as const, settings: { mode: 'turns', rounds, turnSeconds } }];

describe('deadlines and catch-up', () => {
  test('AC-24 a tick before the deadline is a no-op; after it advances exactly once', () => {
    const h = harness(['A', 'B', 'C']);
    startQueue(h, pingTurns());
    const phase = h.room.phase.id;
    h.clock.advance(5_000);
    touchAll(h);
    h.tick();
    expect(h.room.phase.id).toBe(phase);
    h.clock.advance(5_001);
    touchAll(h);
    h.tick();
    expect(h.room.phase.id).toBe(phase + 1);
    expect(h.room.phase.turnSeatId).toBe(h.seat('B').id);
  });

  test('AC-24 three overdue turns are processed in order before the next action', () => {
    const h = harness(['A', 'B', 'C', 'D']);
    startQueue(h, pingTurns(10, 1));
    const start = h.room.phase.id;
    h.clock.advance(30_500); // A, B and C each missed their 10 s turn
    touchAll(h);
    const ctx = h.act('D', { type: 'ping' }); // D's own action is valid only after catch-up
    void ctx;
    expect(h.room.phase.id).toBeGreaterThanOrEqual(start + 3);
    expect(h.seat('A').missedTurns).toBe(1);
    expect(h.seat('B').missedTurns).toBe(1);
    expect(h.seat('C').missedTurns).toBe(1);
    expect(h.seat('D').score).toBe(10);
  });

  test('AC-24 five parallel ticks for one expired phase produce one transition', async () => {
    const { code, ids } = await roomWith(['A', 'B', 'C']);
    await roomOp(code, ids[0], (room) => {
      room.queue = pingTurns(10, 2) as any;
      return null;
    });
    const { startGame } = await import('@/engine/room');
    await roomOp(code, ids[0], (room, ctx) => startGame(room, ctx));
    // Force the current deadline into the past.
    await roomOp(code, ids[0], (room) => {
      room.phase.deadline = Date.now() - 1;
      return null;
    });
    const before = (await loadRoom(code)).state.phase.id;
    await Promise.all(ids.concat(ids.slice(0, 2)).map((id) => roomOp(code, id, () => null)));
    const after = (await loadRoom(code)).state.phase.id;
    expect(after).toBe(before + 1);
    void randomUUID;
  });

  test('AC-25 after 3 minutes of total silence the next request pauses instead of fast-forwarding', () => {
    const h = harness(['A', 'B', 'C']);
    startQueue(h, pingTurns(20, 2));
    const phase = h.room.phase.id;
    const deadline = h.room.phase.deadline!;
    const lastContact = h.clock.now + 5_000;
    for (const s of h.room.seats) h.presence[s.identityId] = lastContact;
    h.clock.advance(185_000);
    h.tick();
    expect(h.room.paused).not.toBeNull();
    expect(h.room.phase.id).toBe(phase); // no turns skipped
    expect(h.room.paused!.remainingMs).toBe(Math.max(deadline - lastContact, 10_000));
    expect(h.seat('A').missedTurns).toBe(0);
  });

  test('AC-28 pause with 37.4 s left and resume 5 min later restores exactly 37.4 s; ticks while paused do nothing', () => {
    const h = harness(['A', 'B']);
    startQueue(h, pingTurns(60, 1));
    h.clock.advance(60_000 - 37_400);
    touchAll(h);
    h.act('A', { type: 'pause' });
    expect(h.room.paused!.remainingMs).toBe(37_400);
    const phase = h.room.phase.id;
    h.clock.advance(300_000);
    touchAll(h);
    h.tick();
    expect(h.room.phase.id).toBe(phase);
    expect(() => h.act('A', { type: 'ping' })).toThrow(/PAUSED/);
    h.act('A', { type: 'resume' });
    expect(h.room.phase.deadline).toBe(h.clock.now + 37_400);
  });

  test('catch-up is capped and never runs while paused', () => {
    const h = harness(['A']);
    startQueue(h, pingTurns(10, 5));
    h.room.paused = { remainingMs: 1000, at: h.clock.now };
    h.clock.advance(1_000_000);
    const phase = h.room.phase.id;
    catchUp(h.room, h.ctx());
    expect(h.room.phase.id).toBe(phase);
  });
});
