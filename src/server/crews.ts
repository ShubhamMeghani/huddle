import 'server-only';
import { randomBytes } from 'node:crypto';
import { q, tx } from './db';
import { GameError } from '@/engine/types';
import type { Identity } from './identity';
import { headToHead, perGameStats, seasonLeaderboard, seasonOf, seasonsIn, type ResultRow } from '@/lib/stats';

export async function createCrew(identity: Identity, name: string) {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!clean) throw new GameError('INVALID', 'Give your crew a name');
  const invite = randomBytes(12).toString('base64url');
  return tx(async (c) => {
    const r = await c.query('insert into crews (name, invite_token, created_by) values ($1, $2, $3) returning id', [clean, invite, identity.id]);
    await c.query('insert into crew_members (crew_id, identity_id) values ($1, $2) on conflict do nothing', [r.rows[0].id, identity.id]);
    return { id: r.rows[0].id as string, inviteToken: invite, name: clean };
  });
}

export async function crewByInvite(token: string) {
  const rows = await q<{ id: string; name: string }>('select id, name from crews where invite_token = $1', [token]);
  if (!rows[0]) throw new GameError('ROOM_NOT_FOUND', 'Crew not found');
  return rows[0];
}

export async function joinCrew(token: string, identity: Identity) {
  const crew = await crewByInvite(token);
  await q('insert into crew_members (crew_id, identity_id) values ($1, $2) on conflict do nothing', [crew.id, identity.id]);
  return crew;
}

export async function crewsOf(identity: Identity) {
  return q<{ id: string; name: string }>(
    `select distinct c.id, c.name, c.created_at from crews c join crew_members m on m.crew_id = c.id
     where m.identity_id = any($1::uuid[]) order by c.created_at desc`,
    [identity.aliases],
  );
}

export async function isMember(crewId: string, identity: Identity): Promise<boolean> {
  const rows = await q('select 1 from crew_members where crew_id = $1 and identity_id = any($2::uuid[])', [crewId, identity.aliases]);
  return rows.length > 0;
}

/** Canonical identity: a merged guest counts as the user it was claimed by. */
const CANON = `coalesce(i.merged_into, i.id)`;

async function members(crewId: string) {
  return q<{ identity_id: string; name: string }>(
    `select distinct on (${CANON}) ${CANON} as identity_id, ci.display_name as name
     from crew_members m join identities i on i.id = m.identity_id join identities ci on ci.id = ${CANON}
     where m.crew_id = $1 order by ${CANON}`,
    [crewId],
  );
}

export async function crewResults(crewId: string): Promise<ResultRow[]> {
  const rows = await q<{
    game_id: string;
    game_type: string;
    ended_at: Date;
    identity_id: string;
    name: string;
    rank: number;
    score: number;
    placement_points: string;
    stats: Record<string, number>;
  }>(
    `select g.id as game_id, g.game_type, g.ended_at, ${CANON} as identity_id, r.display_name as name, r.rank, r.score, r.placement_points, r.stats
     from games g join game_results r on r.game_id = g.id join identities i on i.id = r.identity_id
     where g.crew_id = $1 order by g.ended_at`,
    [crewId],
  );
  return rows.map((r) => ({
    gameId: r.game_id,
    gameType: r.game_type,
    endedAt: new Date(r.ended_at).getTime(),
    excludeFromSeason: r.game_type === 'mlt',
    identityId: r.identity_id,
    name: r.name,
    rank: r.rank,
    score: r.score,
    placementPoints: Number(r.placement_points),
    stats: r.stats ?? {},
  }));
}

export async function crewOverview(crewId: string, identity: Identity, season?: string) {
  const crews = await q<{ id: string; name: string; invite_token: string }>('select id, name, invite_token from crews where id = $1', [crewId]);
  if (!crews[0]) throw new GameError('ROOM_NOT_FOUND', 'Crew not found');
  if (!(await isMember(crewId, identity))) throw new GameError('NOT_SEATED', 'Join the crew to see its page');
  const [mem, results, nights] = await Promise.all([
    members(crewId),
    crewResults(crewId),
    q<{ room_id: string; date_ist: string; awards: unknown; summary: { games?: { gameId: string; winners: string[] }[] } }>(
      `select room_id, to_char(date_ist, 'YYYY-MM-DD') as date_ist, awards, summary from nights where crew_id = $1 order by date_ist desc, updated_at desc limit 50`,
      [crewId],
    ),
  ]);
  const seasons = seasonsIn(results);
  const current = season && /^\d{4}-\d{2}$/.test(season) ? season : seasons[0] ?? seasonOf(Date.now());
  const memberIds = new Set(mem.map((m) => m.identity_id));
  return {
    crew: { id: crews[0].id, name: crews[0].name, inviteToken: crews[0].invite_token },
    members: mem.map((m) => ({ identityId: m.identity_id, name: m.name, stats: perGameStats(results, m.identity_id) })),
    seasons,
    season: current,
    leaderboard: seasonLeaderboard(results, current, memberIds),
    nights: nights.map((n) => ({ roomId: n.room_id, date: n.date_ist, awards: n.awards, games: n.summary.games ?? [] })),
  };
}

export async function crewHeadToHead(crewId: string, identity: Identity, a: string, b: string) {
  if (!(await isMember(crewId, identity))) throw new GameError('NOT_SEATED');
  return headToHead(await crewResults(crewId), a, b);
}
