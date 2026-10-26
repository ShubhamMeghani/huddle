import { afterEach, expect, test, vi } from 'vitest';
import { RoomSync } from '@/client/sync';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Every request gets a timeout signal; the test fires it by hand instead of waiting 10 s. */
function controllableTimeouts() {
  const controllers: (AbortController & { ms?: number })[] = [];
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    const c = Object.assign(new AbortController(), { ms });
    controllers.push(c);
    return c.signal;
  });
  return controllers;
}

const stalled = (signal: AbortSignal) =>
  new Promise<Response>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError'))));

test('SPEC 4.2 (v0.4) a stalled action times out after 30 s and is retried once with the same actionId', async () => {
  const timeouts = controllableTimeouts();
  const bodies: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) return stalled(init.signal!);
      return Promise.resolve(new Response(JSON.stringify({ ok: true, v: 2, serverNow: Date.now() })));
    }),
  );
  const pending = new RoomSync('ABCD').act('wave');
  await vi.waitFor(() => expect(timeouts).toHaveLength(1));
  expect(timeouts[0].ms).toBe(30_000); // an action waits longer than a catch-up before giving up
  timeouts[0].abort(); // the first request never answers: its timeout fires
  const r = await pending;
  expect(r.ok).toBe(true);
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[1]).actionId).toBe(JSON.parse(bodies[0]).actionId);
});

test('SPEC 4.2 (v0.4) a stalled snapshot fetch times out after 10 s and does not block the next one', async () => {
  const timeouts = controllableTimeouts();
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      calls += 1;
      if (calls === 1) return stalled(init.signal!);
      return Promise.resolve(new Response(JSON.stringify({ ok: true, v: 3, serverNow: Date.now(), public: { nextWakeAt: null }, me: { seatId: 's1' } })));
    }),
  );
  const sync = new RoomSync('ABCD');
  const first = sync.fetchSnapshot();
  const queued = sync.fetchSnapshot(); // coalesced behind the stalled one
  await vi.waitFor(() => expect(timeouts).toHaveLength(1));
  expect(timeouts[0].ms).toBe(10_000);
  timeouts[0].abort();
  await Promise.all([first, queued]);
  await vi.waitFor(() => expect(sync.state.snapshot?.v).toBe(3)); // the queued refetch ran and landed
  expect(calls).toBe(2);
});
