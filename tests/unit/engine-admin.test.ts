import { describe, expect, test } from 'vitest';
import { rateLimit } from '@/engine/room';
import { harness, startQueue, touchAll } from '../helpers/engine';

const pingAll = [{ gameId: 'ping' as const, settings: { mode: 'all', rounds: 3, turnSeconds: 10 } }];
const pingTurns = [{ gameId: 'ping' as const, settings: { mode: 'turns', rounds: 3, turnSeconds: 10 } }];

describe('admin, AFK, undo, rate limits', () => {
  test('AC-30 undo twice reverts the last two score events; totals match the remaining events', () => {
    const h = harness(['A', 'B', 'C']);
    startQueue(h, pingAll);
    h.act('A', { type: 'ping' });
    h.act('B', { type: 'ping' });
    h.act('C', { type: 'ping' }); // ends round 1
    h.act('A', { type: 'ping' });
    h.act('A', { type: 'undo' });
    h.act('A', { type: 'undo' });
    const live = h.room.scoreEvents.filter((e) => !e.undone);
    for (const s of h.room.seats) {
      expect(s.score).toBe(live.filter((e) => e.target.seatId === s.id).reduce((a, e) => a + e.points, 0));
    }
    expect(h.seat('A').score).toBe(10);
    expect(h.seat('C').score).toBe(0);
    h.act('A', { type: 'undo' });
    h.act('A', { type: 'undo' });
    expect(() => h.act('A', { type: 'undo' })).toThrow(/Nothing to undo/);
  });

  test('two missed turns mark a player AFK; AFK turns are skipped immediately; any action clears AFK (R21, R22)', () => {
    const h = harness(['A', 'B', 'C']);
    startQueue(h, pingTurns);
    // A pings, B misses, C pings; round 2: A pings, B misses again -> AFK
    h.act('A', { type: 'ping' });
    h.clock.advance(10_001);
    touchAll(h);
    h.tick();
    h.act('C', { type: 'ping' });
    h.act('A', { type: 'ping' });
    h.clock.advance(10_001);
    touchAll(h);
    h.tick();
    expect(h.seat('B').afk).toBe(true);
    expect(h.seat('B').score).toBe(0);
    h.act('C', { type: 'ping' }); // round 3 begins with A
    h.act('A', { type: 'ping' }); // B is AFK: skipped instantly, C's turn
    expect(h.room.phase.turnSeatId).toBe(h.seat('C').id);
    expect(h.seat('B').afkSkips).toBe(1);
    h.act('B', { type: 'imBack' });
    expect(h.seat('B').afk).toBe(false);
    expect(h.seat('B').missedTurns).toBe(0);
  });

  test('admin skip does not count as a missed turn; non-admins get NOT_ADMIN', () => {
    const h = harness(['A', 'B']);
    startQueue(h, pingTurns);
    h.act('A', { type: 'skip' });
    expect(h.seat('A').missedTurns).toBe(0);
    expect(() => h.act('B', { type: 'pause' })).toThrow(/NOT_ADMIN/);
    expect(() => h.act('B', { type: 'kick', seatId: h.seat('A').id })).toThrow(/NOT_ADMIN/);
  });

  test('admin passes to the longest-present connected player when the admin disappears (R26)', () => {
    const h = harness(['A', 'B', 'C']);
    h.clock.advance(61_000);
    h.presence['id-B'] = h.clock.now;
    h.presence['id-C'] = h.clock.now;
    h.tick();
    expect(h.room.adminSeatId).toBe(h.seat('B').id);
  });

  test('AC-49 an 11th action within 1 s and a 4th chat message within 2 s are rate limited', () => {
    const h = harness(['A']);
    const ctx = h.ctx();
    const seat = h.seat('A');
    for (let i = 0; i < 10; i++) rateLimit(h.room, seat, ctx, false);
    expect(() => rateLimit(h.room, seat, ctx, false)).toThrow(/RATE_LIMITED/);
    h.clock.advance(1_100);
    const ctx2 = h.ctx();
    for (let i = 0; i < 3; i++) rateLimit(h.room, seat, ctx2, true);
    expect(() => rateLimit(h.room, seat, ctx2, true)).toThrow(/RATE_LIMITED/);
  });

  test('settings are locked during a game (R27)', () => {
    const h = harness(['A', 'B']);
    startQueue(h, pingTurns);
    expect(() => h.act('A', { type: 'setQueue', queue: pingAll })).toThrow(/WRONG_PHASE/);
  });

  test('a finished queue leads to the night summary; rematch restarts with the same players', () => {
    const h = harness(['A', 'B']);
    startQueue(h, [{ gameId: 'ping', settings: { mode: 'all', rounds: 1, turnSeconds: 10 } }]);
    h.act('A', { type: 'ping' });
    h.act('B', { type: 'ping' });
    expect(h.room.status).toBe('break');
    expect(h.room.lastGame!.rows.map((r) => r.score)).toEqual([10, 10]);
    h.act('A', { type: 'continue' });
    expect(h.room.status).toBe('summary');
    h.act('A', { type: 'rematch' });
    expect(h.room.status).toBe('playing');
    expect(h.room.seats.every((s) => s.score === 0)).toBe(true);
  });
});
