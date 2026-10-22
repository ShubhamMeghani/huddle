import 'server-only';
import { NextResponse } from 'next/server';
import { GameError, type ErrorCode } from '@/engine/types';

const STATUS: Partial<Record<ErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  KICKED: 403,
  NOT_ADMIN: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  ROOM_FULL: 409,
};

export function ok(body: Record<string, unknown> = {}, init?: ResponseInit) {
  return NextResponse.json({ ok: true, serverNow: Date.now(), ...body }, init);
}

export function fail(code: ErrorCode, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, serverNow: Date.now(), ...extra }, { status: STATUS[code] ?? 409 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GameError) return fail(e.code, { message: e.message });
    console.error(e);
    return NextResponse.json({ ok: false, code: 'INTERNAL', serverNow: Date.now() }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
