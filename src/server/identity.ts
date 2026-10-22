import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { q } from './db';
import { auth } from './auth';

export const DEVICE_COOKIE = 'huddle_dt';
export const SCREEN_COOKIE = 'huddle_screen';

export interface Identity {
  id: string;
  kind: 'guest' | 'user';
  name: string;
  /** This identity plus every guest identity merged into it (seat lookup). */
  aliases: string[];
  guestId: string | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  return (h.get('x-forwarded-proto') ?? '').includes('https');
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function guestFromCookie(): Promise<{ id: string; display_name: string; merged_into: string | null } | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const rows = await q<{ id: string; display_name: string; merged_into: string | null }>(
    'select id, display_name, merged_into from identities where device_token_hash = $1',
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

async function aliasesOf(id: string): Promise<string[]> {
  const rows = await q<{ id: string }>('select id from identities where merged_into = $1', [id]);
  return [id, ...rows.map((r) => r.id)];
}

/** Resolve the caller: a signed-in user's identity wins; otherwise the guest device cookie. */
export async function getIdentity(): Promise<Identity | null> {
  const session = await auth().catch(() => null);
  const userIdentityId = (session as { identityId?: string } | null)?.identityId;
  const guest = await guestFromCookie();
  if (userIdentityId) {
    const rows = await q<{ id: string; display_name: string }>('select id, display_name from identities where id = $1', [
      userIdentityId,
    ]);
    if (rows[0]) {
      return {
        id: rows[0].id,
        kind: 'user',
        name: rows[0].display_name,
        aliases: await aliasesOf(rows[0].id),
        guestId: guest && !guest.merged_into ? guest.id : null,
      };
    }
  }
  if (!guest) return null;
  if (guest.merged_into) {
    // A merged guest on a signed-out device keeps acting as the merged identity's alias.
    return { id: guest.id, kind: 'guest', name: guest.display_name, aliases: [guest.id, guest.merged_into], guestId: guest.id };
  }
  return { id: guest.id, kind: 'guest', name: guest.display_name, aliases: [guest.id], guestId: guest.id };
}

/** Create (or rename) the guest identity bound to this device. */
export async function ensureGuest(name: string): Promise<Identity> {
  const existing = await getIdentity();
  if (existing) {
    await q('update identities set display_name = $2 where id = $1', [existing.id, name]);
    return { ...existing, name };
  }
  const token = randomBytes(32).toString('base64url');
  const rows = await q<{ id: string }>(
    "insert into identities (kind, display_name, device_token_hash) values ('guest', $1, $2) returning id",
    [name, hashToken(token)],
  );
  await setDeviceCookie(token);
  return { id: rows[0].id, kind: 'guest', name, aliases: [rows[0].id], guestId: rows[0].id };
}

/** Upsert a user and its identity on sign-in (Auth.js jwt callback). */
export async function upsertUser(u: { sub: string; email?: string | null; name?: string | null; image?: string | null }) {
  const users = await q<{ id: string }>(
    `insert into users (google_sub, email, name, image) values ($1, $2, $3, $4)
     on conflict (google_sub) do update set email = excluded.email, name = excluded.name, image = excluded.image
     returning id`,
    [u.sub, u.email ?? null, u.name ?? null, u.image ?? null],
  );
  const userId = users[0].id;
  const display = (u.name ?? u.email ?? 'Player').slice(0, 24);
  const ids = await q<{ id: string }>(
    `insert into identities (kind, display_name, user_id) values ('user', $1, $2)
     on conflict (user_id) do update set display_name = identities.display_name
     returning id`,
    [display, userId],
  );
  return { userId, identityId: ids[0].id };
}
