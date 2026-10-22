import 'server-only';

/** Test mode enables seeded RNG, short timers, the test sign-in provider and the local realtime driver.
 *  It can never be on inside Vercel (preview or production). */
export function isTestMode(): boolean {
  if (process.env.HUDDLE_TEST_MODE !== '1') return false;
  if (process.env.VERCEL_ENV) {
    throw new Error('HUDDLE_TEST_MODE is not allowed on Vercel');
  }
  return true;
}

export type RealtimeDriverName = 'ably' | 'local';

export function realtimeDriverName(): RealtimeDriverName {
  if (process.env.REALTIME_DRIVER === 'local') {
    if (process.env.VERCEL_ENV) throw new Error('REALTIME_DRIVER=local is not allowed on Vercel');
    return 'local';
  }
  return 'ably';
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function googleEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/** Admin hand-off grace; shortened in test mode so E2E can exercise it. */
export function adminGraceMs(): number {
  const v = Number(process.env.HUDDLE_ADMIN_GRACE_MS);
  return isTestMode() && v > 0 ? v : 60_000;
}

export function silencePauseMs(): number {
  const v = Number(process.env.HUDDLE_SILENCE_MS);
  return isTestMode() && v > 0 ? v : 120_000;
}

export function presenceMs(): number {
  const v = Number(process.env.HUDDLE_PRESENCE_MS);
  return isTestMode() && v > 0 ? v : 60_000;
}

export function breakMs(): number {
  const v = Number(process.env.HUDDLE_BREAK_MS);
  return isTestMode() && v > 0 ? v : 30_000;
}
