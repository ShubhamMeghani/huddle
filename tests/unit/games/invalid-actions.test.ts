import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { applyAction } from '@/engine/room';
import { requireSeat, roomOp } from '@/server/rooms';
import { GameError, type GameAction, type GameId, type RoomState } from '@/engine/types';
import type { Identity } from '@/server/identity';
import { fastSettings } from '../../helpers/drive';
import { loadRoom, roomWith } from '../../helpers/unit-room';

type Who = 'turn' | 'notTurn' | 'any';
interface Case {
  name: string;
  who: Who;
  action: GameAction;
  code: string;
  pausedFirst?: boolean;
}

/** Per game: wrong phase, not your turn (turn-based games), malformed, and any game action while paused. */
const CASES: Record<GameId, Case[]> = {
  quiz: [
    { name: 'wrong phase', who: 'any', action: { type: 'continue' }, code: 'NOT_ADMIN|WRONG_PHASE' },
    { name: 'malformed', who: 'any', action: { type: 'answer', choice: 7 }, code: 'INVALID' },
    { name: 'paused', who: 'any', action: { type: 'answer', choice: 0 }, code: 'PAUSED', pausedFirst: true },
  ],
  draw: [
    { name: 'wrong phase', who: 'notTurn', action: { type: 'guess', text: 'hello' }, code: 'WRONG_PHASE' },
    { name: 'not your turn', who: 'notTurn', action: { type: 'choose', index: 0 }, code: 'NOT_YOUR_TURN' },
    { name: 'malformed', who: 'turn', action: { type: 'choose', index: 5 }, code: 'INVALID' },
    { name: 'paused', who: 'turn', action: { type: 'choose', index: 0 }, code: 'PAUSED', pausedFirst: true },
  ],
  imposter: [
    { name: 'wrong phase', who: 'any', action: { type: 'vote', seatId: 's1' }, code: 'WRONG_PHASE' },
    { name: 'not your turn', who: 'notTurn', action: { type: 'clue', text: 'hello' }, code: 'NOT_YOUR_TURN' },
    { name: 'malformed', who: 'turn', action: { type: 'clue', text: 'two words' }, code: 'INVALID' },
    { name: 'paused', who: 'turn', action: { type: 'clue', text: 'hello' }, code: 'PAUSED', pausedFirst: true },
  ],
  atlas: [
    { name: 'wrong phase', who: 'notTurn', action: { type: 'vote', accept: true }, code: 'WRONG_PHASE' },
    { name: 'not your turn', who: 'notTurn', action: { type: 'submit', text: 'Delhi' }, code: 'NOT_YOUR_TURN' },
    { name: 'malformed', who: 'turn', action: { type: 'submit', text: '' }, code: 'INVALID' },
    { name: 'paused', who: 'turn', action: { type: 'submit', text: 'Delhi' }, code: 'PAUSED', pausedFirst: true },
  ],
  charades: [
    { name: 'wrong phase', who: 'turn', action: { type: 'steal', teamId: null }, code: 'WRONG_PHASE' },
    { name: 'not your turn', who: 'notTurn', action: { type: 'guessed' }, code: 'NOT_YOUR_TURN' },
    { name: 'malformed', who: 'turn', action: { type: 'dance' }, code: 'INVALID' },
    { name: 'paused', who: 'turn', action: { type: 'guessed' }, code: 'PAUSED', pausedFirst: true },
  ],
  mlt: [
    { name: 'wrong phase', who: 'any', action: { type: 'continue' }, code: 'NOT_ADMIN|WRONG_PHASE' },
    { name: 'malformed', who: 'any', action: { type: 'vote', seatId: 'nobody' }, code: 'INVALID' },
    { name: 'paused', who: 'any', action: { type: 'vote', seatId: 's1' }, code: 'PAUSED', pausedFirst: true },
  ],
  npat: [
    { name: 'wrong phase', who: 'any', action: { type: 'voteDone' }, code: 'WRONG_PHASE' },
    { name: 'malformed', who: 'any', action: { type: 'fill', answers: 'Bunty' }, code: 'INVALID' },
    { name: 'paused', who: 'any', action: { type: 'done' }, code: 'PAUSED', pausedFirst: true },
  ],
  emoji: [
    { name: 'wrong phase', who: 'any', action: { type: 'continue' }, code: 'NOT_ADMIN|WRONG_PHASE' },
    { name: 'malformed', who: 'any', action: { type: 'guess', text: '   ' }, code: 'INVALID' },
    { name: 'paused', who: 'any', action: { type: 'guess', text: 'Sholay' }, code: 'PAUSED', pausedFirst: true },
  ],
  truths: [
    { name: 'wrong phase', who: 'any', action: { type: 'vote', choice: 0 }, code: 'WRONG_PHASE' },
    { name: 'malformed', who: 'any', action: { type: 'submit', texts: ['only one'], lie: 0 }, code: 'INVALID' },
    { name: 'paused', who: 'any', action: { type: 'submit', texts: ['a', 'b', 'c'], lie: 0 }, code: 'PAUSED', pausedFirst: true },
  ],
  ping: [],
};

function turnSeat(state: RoomState): string | null {
  const g = state.game?.state as { actorId?: string } | undefined;
  return state.phase.turnSeatId ?? g?.actorId ?? null;
}

async function setup(id: GameId) {
  const { code, ids } = await roomWith(['A', 'B', 'C', 'D', 'E'], `invalid-${id}`);
  await roomOp(code, ids[0], (room, ctx) => {
    if (id === 'charades') applyAction(room, requireSeat(room, ids[0]), { type: 'setTeams', mode: 'shuffle', count: 2 }, ctx);
    applyAction(room, requireSeat(room, ids[0]), { type: 'start', queue: [{ gameId: id, settings: fastSettings(id) }] }, ctx);
    return null;
  });
  return { code, ids };
}

function actor(state: RoomState, ids: Identity[], who: Who): Identity {
  const turn = turnSeat(state);
  const pickSeat = (pred: (seatId: string) => boolean) => state.seats.find((s) => s.status === 'seated' && pred(s.id))!;
  const seat = who === 'turn' && turn ? pickSeat((x) => x === turn) : who === 'notTurn' && turn ? pickSeat((x) => x !== turn && x !== state.adminSeatId) : pickSeat((x) => x !== state.adminSeatId);
  return ids.find((i) => i.id === seat.identityId)!;
}

describe('AC-13 invalid actions return a code and change nothing (every game)', () => {
  for (const id of ['quiz', 'draw', 'imposter', 'atlas', 'charades', 'mlt', 'npat', 'emoji', 'truths'] as GameId[]) {
    for (const c of CASES[id]) {
      test(`AC-13 ${id}: ${c.name} → ${c.code}`, async () => {
        const { code, ids } = await setup(id);
        if (c.pausedFirst) {
          await roomOp(code, ids[0], (room, ctx) => applyAction(room, requireSeat(room, ids[0]), { type: 'pause' }, ctx));
        }
        const before = await loadRoom(code);
        const who = actor(before.state, ids, c.who);
        const err = await roomOp(
          code,
          who,
          (room, ctx) => applyAction(room, requireSeat(room, who), c.action, ctx),
          { actionId: randomUUID(), type: c.action.type },
        ).then(
          () => null,
          (e: GameError) => e,
        );
        expect(err).toBeInstanceOf(GameError);
        expect(err!.code).toMatch(new RegExp(`^(${c.code})$`));
        const after = await loadRoom(code);
        expect(after.version).toBe(before.version);
        expect(after.state).toEqual(before.state);
      });
    }
  }
});
