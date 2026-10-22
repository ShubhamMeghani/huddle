import { describe, expect, test } from 'vitest';
import prompts from '../../../content/mlt-prompts.json';
import { tallyOf } from '@/games/mlt/rules';
import { privateView, publicView, applyAction } from '@/engine/room';
import { requireSeat, roomOp } from '@/server/rooms';
import { q } from '@/server/db';
import { harness, startQueue } from '../../helpers/engine';
import { loadRoom, roomWith } from '../../helpers/unit-room';

const queue = [{ gameId: 'mlt' as const, settings: { rounds: 2, voteSeconds: 20, selfVote: false } }];

describe('Most Likely To', () => {
  test('AC-74 at least 150 unique prompts, each "Most likely to…" and at most 100 characters', () => {
    expect(prompts.length).toBeGreaterThanOrEqual(150);
    expect(new Set(prompts.map((p) => p.text.toLowerCase())).size).toBe(prompts.length);
    for (const p of prompts) {
      expect(p.text).toMatch(/^Most likely to /);
      expect(p.text.length).toBeLessThanOrEqual(100);
    }
  });

  test('AC-74 tallies are correct and revealed in ascending order', () => {
    const t = tallyOf({ a: 'b', b: 'c', c: 'b', d: 'b' }, ['a', 'b', 'c', 'd']);
    expect(t).toEqual([
      { seatId: 'a', votes: 0 },
      { seatId: 'd', votes: 0 },
      { seatId: 'c', votes: 1 },
      { seatId: 'b', votes: 3 },
    ]);
  });

  test('AC-74 after the tally no voter → votee pairs remain in state or any view', () => {
    const h = harness(['A', 'B', 'C', 'D']);
    startQueue(h, queue);
    const [A, B, C, D] = h.room.seats;
    expect(() => h.act(A, { type: 'vote', seatId: A.id })).toThrow(/Self-votes/);
    h.act(A, { type: 'vote', seatId: B.id });
    h.act(B, { type: 'vote', seatId: C.id });
    expect(JSON.stringify(publicView(h.room, {}, h.clock.now))).not.toContain(`"${A.id}":"${B.id}"`);
    expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: A.id }))).not.toContain(B.id);
    h.act(C, { type: 'vote', seatId: B.id });
    h.act(D, { type: 'vote', seatId: B.id });
    expect(h.room.phase.kind).toBe('reveal');
    const g = h.room.game!.state as { votes: Record<string, string>; totals: { seatId: string; votes: number }[] };
    expect(g.votes).toEqual({});
    expect(g.totals.at(-1)).toEqual({ seatId: B.id, votes: 3 });
    expect(JSON.stringify(h.room)).not.toMatch(new RegExp(`"${A.id}":"${B.id}"`));
  });

  test('AC-74 the database never stores who voted for whom', async () => {
    const { code, ids } = await roomWith(['A', 'B', 'C'], 'mlt-db');
    await roomOp(code, ids[0], (room, ctx) => applyAction(room, requireSeat(room, ids[0]), { type: 'start', queue }, ctx));
    const seats = (await loadRoom(code)).state.seats;
    const target = seats[1].id;
    for (const [i, id] of ids.entries()) {
      const vote = i === 1 ? seats[0].id : target;
      await roomOp(code, id, (room, ctx) => applyAction(room, requireSeat(room, id), { type: 'vote', seatId: vote }, ctx), { actionId: crypto.randomUUID(), type: 'vote' });
    }
    const state = (await loadRoom(code)).state;
    expect(state.phase.kind).toBe('reveal');
    expect(JSON.stringify(state)).not.toMatch(/"votes":\{"s\d/);
    const rows = await q<{ result: unknown }>("select result from room_actions where type = 'vote' and room_id = $1", [state.roomId]);
    expect(rows.length).toBe(3);
    for (const r of rows) expect(JSON.stringify(r.result)).not.toContain(target);
  });
});
