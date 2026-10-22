/* Pure-engine test harness: build rooms and contexts without a database. */
import { joinRoom, newRoomState, applyAction, catchUp, planBots } from '@/engine/room';
import { roomRng } from '@/engine/rng';
import type { Ctx, GameAction, GameConfig, RoomState, Seat } from '@/engine/types';

export class Clock {
  constructor(public now = 1_700_000_000_000) {}
  advance(ms: number) {
    this.now += ms;
    return this.now;
  }
}

export function ctxFor(room: RoomState, clock: Clock, presence: Record<string, number> = {}, testMode = true): Ctx {
  return {
    now: clock.now,
    rng: roomRng(room),
    effects: [],
    private: null,
    presence,
    testMode,
    adminGraceMs: 60_000,
    silencePauseMs: 120_000,
    breakMs: 30_000,
    presenceMs: 60_000,
  };
}

export interface Harness {
  room: RoomState;
  clock: Clock;
  seats: Seat[];
  /** presence map: everyone "seen now" unless changed */
  presence: Record<string, number>;
  ctx: () => Ctx;
  act: (seat: Seat | string, action: GameAction) => Ctx;
  tick: () => Ctx;
  seat: (name: string) => Seat;
}

export function harness(names: string[], opts: { seed?: string; bots?: string[] } = {}): Harness {
  const clock = new Clock();
  const room = newRoomState({ roomId: 'room-1', code: 'TEST', now: clock.now, seed: opts.seed ?? 'seed' });
  const presence: Record<string, number> = {};
  const h: Harness = {
    room,
    clock,
    seats: [],
    presence,
    ctx: () => ctxFor(room, clock, presence),
    act(seat, action) {
      const s = typeof seat === 'string' ? h.seat(seat) : seat;
      const ctx = h.ctx();
      catchUp(room, ctx);
      applyAction(room, s, action, ctx);
      planBots(room, ctx);
      return ctx;
    },
    tick() {
      const ctx = h.ctx();
      catchUp(room, ctx);
      return ctx;
    },
    seat(name) {
      const s = room.seats.find((x) => x.name === name);
      if (!s) throw new Error(`no seat ${name}`);
      return s;
    },
  };
  for (const n of names) {
    const ctx = h.ctx();
    h.seats.push(joinRoom(room, { identityIds: [`id-${n}`], identityId: `id-${n}`, name: n }, ctx));
    presence[`id-${n}`] = clock.now;
  }
  for (const n of opts.bots ?? []) {
    h.seats.push(joinRoom(room, { identityIds: [`bot-${n}`], identityId: `bot-${n}`, name: n, isBot: true }, h.ctx()));
  }
  return h;
}

/** Keeps everyone's presence fresh (as if all phones were open). */
export function touchAll(h: Harness) {
  for (const s of h.room.seats) h.presence[s.identityId] = h.clock.now;
}

export function startQueue(h: Harness, queue: GameConfig[]) {
  const admin = h.room.seats.find((s) => s.id === h.room.adminSeatId)!;
  return h.act(admin, { type: 'start', queue });
}
