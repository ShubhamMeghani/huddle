/* Ping: an internal, test-mode-only game used to exercise the engine (turns, simultaneous phases, AFK). */
import { activeSeats, award, finishGame, seatById, seatWaiting, setPhase, skipIfAfk, turnMissed } from '@/engine/core';
import { GameError, type Ctx, type RoomState } from '@/engine/types';
import type { GameModule } from '../types';

interface PingState {
  mode: 'turns' | 'all';
  round: number;
  rounds: number;
  turnMs: number;
  order: string[];
  turnIdx: number;
  tapped: string[];
  pings: Record<string, number>;
}

const st = (room: RoomState) => room.game!.state as PingState;

function beginRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  seatWaiting(room, ctx);
  s.order = room.seats.filter((x) => x.status === 'seated').map((x) => x.id);
  s.turnIdx = -1;
  s.tapped = [];
  if (s.mode === 'all') setPhase(room, 'ping-all', s.turnMs, ctx);
  else nextTurn(room, ctx);
}

function nextTurn(room: RoomState, ctx: Ctx) {
  const s = st(room);
  for (;;) {
    s.turnIdx += 1;
    if (s.turnIdx >= s.order.length) return endRound(room, ctx);
    const id = s.order[s.turnIdx];
    if (!seatById(room, id) || seatById(room, id)!.status !== 'seated') continue;
    if (skipIfAfk(room, id)) continue;
    setPhase(room, 'ping-turn', s.turnMs, ctx, id);
    return;
  }
}

function endRound(room: RoomState, ctx: Ctx) {
  const s = st(room);
  if (s.round >= s.rounds) return finishGame(room, ctx, Object.fromEntries(Object.entries(s.pings).map(([k, v]) => [k, { pings: v }])));
  s.round += 1;
  beginRound(room, ctx);
}

export const ping: GameModule = {
  id: 'ping',
  start(room, ctx) {
    const set = room.game!.settings as { mode: 'turns' | 'all'; rounds: number; turnSeconds: number };
    room.game!.state = { mode: set.mode, round: 1, rounds: set.rounds, turnMs: set.turnSeconds * 1000, order: [], turnIdx: -1, tapped: [], pings: {} } satisfies PingState;
    beginRound(room, ctx);
  },
  act(room, seat, action, ctx) {
    if (action.type !== 'ping') throw new GameError('INVALID');
    const s = st(room);
    if (s.mode === 'turns') {
      if (room.phase.kind !== 'ping-turn') throw new GameError('WRONG_PHASE');
      if (room.phase.turnSeatId !== seat.id) throw new GameError('NOT_YOUR_TURN');
      award(room, { seatId: seat.id }, 10, 'ping');
      s.pings[seat.id] = (s.pings[seat.id] ?? 0) + 1;
      return nextTurn(room, ctx);
    }
    if (room.phase.kind !== 'ping-all') throw new GameError('WRONG_PHASE');
    if (s.tapped.includes(seat.id)) throw new GameError('INVALID', 'Already pinged');
    s.tapped.push(seat.id);
    award(room, { seatId: seat.id }, 10, 'ping');
    s.pings[seat.id] = (s.pings[seat.id] ?? 0) + 1;
    if (activeSeats(room).every((x) => s.tapped.includes(x.id))) endRound(room, ctx);
  },
  onDeadline(room, ctx) {
    const s = st(room);
    if (room.phase.kind === 'ping-turn') {
      if (room.phase.turnSeatId) turnMissed(room, room.phase.turnSeatId, ctx);
      return nextTurn(room, ctx);
    }
    if (room.phase.kind === 'ping-all') {
      for (const x of activeSeats(room)) if (!s.tapped.includes(x.id)) turnMissed(room, x.id, ctx);
      return endRound(room, ctx);
    }
  },
  publicView(room) {
    const s = st(room);
    return { mode: s.mode, round: s.round, rounds: s.rounds, tapped: s.tapped };
  },
  privateView(room, seat) {
    const s = st(room);
    if (!seat) return { mustAct: false };
    const mustAct =
      (room.phase.kind === 'ping-turn' && room.phase.turnSeatId === seat.id) ||
      (room.phase.kind === 'ping-all' && seat.status === 'seated' && !s.tapped.includes(seat.id));
    return { mustAct };
  },
  bot(room, seat) {
    const s = st(room);
    const mine = room.phase.kind === 'ping-turn' ? room.phase.turnSeatId === seat.id : room.phase.kind === 'ping-all' && !s.tapped.includes(seat.id);
    return mine ? { delayMs: 400, action: { type: 'ping' } } : null;
  },
  seatRemoved(room, seatId, ctx) {
    if (room.phase.turnSeatId === seatId) nextTurn(room, ctx);
  },
};
