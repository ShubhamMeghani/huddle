/* Server clock estimation (SPEC §4.3): offset = serverNow − (tSend + tRecv) / 2,
 * taken from the lowest-RTT sample among the last 5 responses. */

export interface ClockSample {
  offset: number;
  rtt: number;
}

export class ServerClock {
  private samples: ClockSample[] = [];
  /** Optional override for tests: the local clock function. */
  constructor(private local: () => number = () => Date.now()) {}

  addSample(tSend: number, tRecv: number, serverNow: number) {
    if (!Number.isFinite(serverNow)) return;
    this.samples.push({ offset: serverNow - (tSend + tRecv) / 2, rtt: tRecv - tSend });
    if (this.samples.length > 5) this.samples.shift();
  }

  get offset(): number {
    if (!this.samples.length) return 0;
    return this.samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  }

  now(): number {
    return this.local() + this.offset;
  }

  /** Remaining ms until a server deadline. */
  remaining(deadline: number | null): number {
    if (deadline == null) return 0;
    return Math.max(0, deadline - this.now());
  }

  /** Whole seconds shown on the countdown. */
  secondsLeft(deadline: number | null): number {
    return Math.ceil(this.remaining(deadline) / 1000);
  }
}
