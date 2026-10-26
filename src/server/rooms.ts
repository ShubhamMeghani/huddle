import 'server-only';
import { randomUUID } from 'node:crypto';
import { tx, type Tx } from './db';
import { publish } from './realtime';
import { adminGraceMs, breakMs, isTestMode, presenceMs, silencePauseMs } from './env';
import { generateRoomCode } from '@/lib/codes';
import { roomRng } from '@/engine/rng';
import {
  catchUp,
  planBots,
  joinRoom,
  newRoomState,
  privateChanges,
  privateView,
  publicView,
  seatOf,
  viewerFor,
} from '@/engine/room';
import { GameError, type Ctx, type Effect, type RoomState } from '@/engine/types';
import type { Identity } from './identity';
import { applyEffects } from './effects';

export interface OpOutcome<T> {
  room: RoomState;
  result: T;
  changed: boolean;
  presence: Record<string, number>;
  serverNow: number;
  private: Record<string, unknown> | null;
  replayed?: boolean;
}

function makeCtx(room: RoomState, now: number, presence: Record<string, number>): Ctx {
  return {
    now,
    rng: roomRng(room),
    effects: [] as Effect[],
    private: null,
    presence,
    testMode: isTestMode(),
    adminGraceMs: adminGraceMs(),
    silencePauseMs: silencePauseMs(),
    breakMs: breakMs(),
    presenceMs: presenceMs(),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadRatings(c: Tx, room: RoomState): Promise<Record<string, Record<string, number>>> {
  const ids = room.seats.map((s) => s.identityId).filter((id) => UUID_RE.test(id));
  if (!ids.length) return {};
  const rows = await c.query('select identity_id, game_type, rating from ratings where identity_id = any($1::uuid[])', [ids]);
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows.rows) (out[r.identity_id] ??= {})[r.game_type] = Number(r.rating);
  return out;
}

async function loadPresence(c: Tx, roomId: string): Promise<Record<string, number>> {
  const rows = await c.query(
    'select identity_id, (extract(epoch from last_seen_at) * 1000)::float8 as t from presence where room_id = $1',
    [roomId],
  );
  const out: Record<string, number> = {};
  for (const r of rows.rows) out[r.identity_id] = Number(r.t);
  return out;
}

export async function createRoom(opts: {
  identity: Identity;
  /** Tests only: force a specific code. */
  code?: string;
  isDemo?: boolean;
  crewId?: string | null;
  seed?: string;
  setup?: (room: RoomState, ctx: Ctx) => void;
}): Promise<{ code: string; roomId: string }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = opts.code ?? generateRoomCode();
    const roomId = randomUUID();
    const now = Date.now();
    const room = newRoomState({ roomId, code, isDemo: opts.isDemo, crewId: opts.crewId, now, seed: opts.seed ?? randomUUID(), intros: !isTestMode() });
    const ctx = makeCtx(room, now, { [opts.identity.id]: now });
    joinRoom(room, { identityIds: opts.identity.aliases, identityId: opts.identity.id, name: opts.identity.name }, ctx);
    opts.setup?.(room, ctx);
    room.v = 1;
    const created = await tx(async (c) => {
      // Retire an expired room holding this code so the code becomes reusable (R8).
      await c.query("update rooms set ended_at = now() where code = $1 and ended_at is null and expires_at <= now()", [code]);
      const ins = await c.query(
        `insert into rooms (id, code, crew_id, is_demo, state, version, expires_at)
         values ($1, $2, $3, $4, $5, 1, now() + interval '24 hours')
         on conflict do nothing returning id`,
        [roomId, code, opts.crewId ?? null, Boolean(opts.isDemo), JSON.stringify(room)],
      );
      if (ins.rowCount === 0) return false;
      await c.query(
        `insert into presence (room_id, identity_id, last_seen_at) values ($1, $2, now())
         on conflict (room_id, identity_id) do update set last_seen_at = now()`,
        [roomId, opts.identity.id],
      );
      return true;
    });
    if (created) return { code, roomId };
  }
  throw new Error('Could not allocate a room code');
}

/**
 * The single write path for a room (SPEC §4.2 action pipeline).
 * Locks the row, replays idempotent actions, runs catch-up, applies `op`, bumps the version
 * when anything changed, records the action, updates presence and publishes after commit.
 */
/** Loads what every op needs: presence, a working copy of the state, and the context. */
async function prepare(c: Tx, row: { id: string; state: RoomState; version: number }, now: number) {
  const presence = await loadPresence(c, row.id);
  const before = row.state;
  const room = structuredClone(before);
  room.v = row.version;
  const ctx = makeCtx(room, now, presence);
  if (room.status !== 'playing') {
    ctx.ratings = await loadRatings(c, room);
    const ex = await c.query('select question_id from question_reports group by question_id having count(*) >= 3');
    ctx.excludedQuestions = ex.rows.map((r: { question_id: string }) => r.question_id);
  }
  return { presence, before, room, ctx };
}

/**
 * Snapshot, tick and heartbeat usually change nothing. They run catch-up on an unlocked read first and take the
 * row lock only when something is due, so a room's phones never queue behind each other's no-op requests.
 * Returns null when the locked path must run.
 */
export async function peekRoom(code: string, identity: Identity | null): Promise<OpOutcome<null> | null> {
  const now = Date.now();
  return tx(async (c) => {
    const rows = await c.query(
      `select id, state, version, last_activity_at < now() - interval '1 minute' as idle from rooms
       where code = $1 and ended_at is null and expires_at > now()`,
      [code],
    );
    if (rows.rowCount === 0) throw new GameError('ROOM_NOT_FOUND');
    const row = rows.rows[0];
    if (row.idle) return null; // the locked path also extends the room's expiry
    const { presence, before, room, ctx } = await prepare(c, row, now);
    catchUp(room, ctx);
    planBots(room, ctx);
    if (ctx.effects.length || JSON.stringify(room) !== JSON.stringify({ ...before, v: row.version })) return null;
    if (identity) {
      await c.query(
        `insert into presence (room_id, identity_id, last_seen_at) values ($1, $2, now())
         on conflict (room_id, identity_id) do update set last_seen_at = now()`,
        [row.id, identity.id],
      );
      presence[identity.id] = now;
    }
    return { room, result: null, changed: false, presence, serverNow: now, private: null };
  });
}

export async function roomOp<T>(
  code: string,
  identity: Identity | null,
  op: (room: RoomState, ctx: Ctx) => T,
  opts: { actionId?: string; type?: string; touchPresence?: boolean } = {},
): Promise<OpOutcome<T>> {
  const now = Date.now();
  const outcome = await tx(async (c) => {
    const rows = await c.query(
      `select id, state, version from rooms
       where code = $1 and ended_at is null and expires_at > now() for update`,
      [code],
    );
    if (rows.rowCount === 0) throw new GameError('ROOM_NOT_FOUND');
    const row = rows.rows[0];
    if (opts.actionId) {
      const prev = await c.query('select result from room_actions where room_id = $1 and action_id = $2', [row.id, opts.actionId]);
      if (prev.rowCount) {
        const stored = prev.rows[0].result as { result: T; private: Record<string, unknown> | null };
        const room = row.state as RoomState;
        return {
          room,
          result: stored.result,
          changed: false,
          presence: await loadPresence(c, row.id),
          serverNow: now,
          private: stored.private,
          replayed: true,
          before: room,
          strokes: [],
        };
      }
    }
    const { presence, before, room, ctx } = await prepare(c, row, now);
    catchUp(room, ctx);
    const result = op(room, ctx);
    planBots(room, ctx);
    const changed = JSON.stringify(room) !== JSON.stringify(before);
    if (changed) {
      room.v = row.version + 1;
      await c.query(
        `update rooms set state = $2, version = $3, last_activity_at = now(), expires_at = now() + interval '24 hours'
         where id = $1`,
        [row.id, JSON.stringify(room), room.v],
      );
      await applyEffects(c, room, ctx.effects);
    } else {
      await c.query(
        `update rooms set last_activity_at = now(), expires_at = now() + interval '24 hours'
         where id = $1 and last_activity_at < now() - interval '1 minute'`,
        [row.id],
      );
    }
    if (opts.actionId) {
      await c.query(
        `insert into room_actions (room_id, action_id, identity_id, type, result, version_after)
         values ($1, $2, $3, $4, $5, $6)`,
        [row.id, opts.actionId, identity?.id ?? null, opts.type ?? 'action', JSON.stringify({ result, private: ctx.private }), room.v],
      );
    }
    if (identity && opts.touchPresence !== false) {
      await c.query(
        `insert into presence (room_id, identity_id, last_seen_at) values ($1, $2, now())
         on conflict (room_id, identity_id) do update set last_seen_at = now()`,
        [row.id, identity.id],
      );
      presence[identity.id] = now;
    }
    const strokes = ctx.effects.filter((e) => e.type === 'strokes');
    return { room, result, changed, presence, serverNow: now, private: ctx.private, before, strokes };
  });

  if (outcome.changed) {
    await publish(outcome.room.roomId, 'state', {
      v: outcome.room.v,
      serverNow: Date.now(),
      public: publicView(outcome.room, outcome.presence, Date.now(), presenceMs()),
      privateFor: privateChanges(outcome.before, outcome.room),
    });
  }
  for (const e of outcome.strokes) {
    if (e.type === 'strokes') await publish(outcome.room.roomId, 'strokes', { turnId: e.turnId, seq: e.seq, ops: e.ops });
  }
  const { before: _before, strokes: _strokes, ...rest } = outcome;
  return rest;
}

/** Snapshot payload for one viewer (SPEC §4.2): public view + that viewer's private view. */
export function snapshotFor(room: RoomState, presence: Record<string, number>, identity: Identity | null, screen = false) {
  const now = Date.now();
  const viewer = viewerFor(room, identity?.aliases ?? [], screen);
  return {
    v: room.v,
    public: publicView(room, presence, now, presenceMs()),
    me: privateView(room, viewer),
  };
}

export function requireSeat(room: RoomState, identity: Identity | null) {
  if (!identity) throw new GameError('UNAUTHORIZED');
  const seat = seatOf(room, identity.aliases);
  if (!seat) throw new GameError('NOT_SEATED');
  if (seat.status === 'kicked') throw new GameError('KICKED');
  return seat;
}
