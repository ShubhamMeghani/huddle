import { expect, test } from 'vitest';
import { ServerClock } from '@/client/clock';

test('AC-22 offset estimation keeps remaining time within 500 ms for ±90 s skew and 50–400 ms RTT', () => {
  for (const skew of [90_000, -90_000, 0]) {
    let local = 1_000_000;
    const clock = new ServerClock(() => local);
    const serverAt = (l: number) => l + skew;
    for (const rtt of [400, 250, 50, 300, 120]) {
      const tSend = local;
      // Server timestamps the response at an arbitrary point inside the round trip.
      const serverNow = serverAt(tSend + rtt * 0.7);
      local += rtt;
      clock.addSample(tSend, local, serverNow);
    }
    const deadline = serverAt(local) + 30_000;
    expect(Math.abs(clock.remaining(deadline) - 30_000)).toBeLessThanOrEqual(500);
  }
});

test('safeNow never runs ahead of the server, even when every response was slow and stamped late', () => {
  for (const skew of [90_000, -90_000, 0]) {
    let local = 1_000_000;
    const clock = new ServerClock(() => local);
    const serverAt = (l: number) => l + skew;
    for (const rtt of [5_000, 4_000, 6_000, 4_500, 5_500]) {
      const tSend = local;
      local += rtt;
      clock.addSample(tSend, local, serverAt(local - 20)); // stamped just before the response left
    }
    expect(clock.safeNow()).toBeLessThanOrEqual(serverAt(local));
    expect(serverAt(local) - clock.safeNow()).toBeLessThanOrEqual(50);
    expect(clock.now() - serverAt(local)).toBeGreaterThan(1_000); // the midpoint estimate is ahead here
  }
});
