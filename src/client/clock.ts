/* Server clock estimation (SPEC §4.3): offset = serverNow − (tSend + tRecv) / 2,
 * taken from the lowest-RTT sample among the last 5 responses. `safeNow` is a lower bound for deciding that a
 * deadline has passed: the server stamped serverNow before tRecv, so the offset is at least serverNow − tRecv. */

export interface ClockSample {
  offset: number;
  rtt: number;
  /** Smallest offset consistent with this sample. */
  min: number;
}

export class ServerClock {
  private samples: ClockSample[] = [];
  /** Optional override for tests: the local clock function. */
  constructor(private local: () => number = () => Date.now()) {}

  addSample(tSend: number, tRecv: number, serverNow: number) {
    if (!Number.isFinite(serverNow)) return;
    this.samples.push({ offset: serverNow - (tSend + tRecv) / 2, rtt: tRecv - tSend, min: serverNow - tRecv });
    if (this.samples.length > 5) this.samples.shift();
  }

  get offset(): number {
    if (!this.samples.length) return 0;
    return this.samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  }

  now(): number {
    return this.local() + this.offset;
  }

  /** Server time that has certainly been reached; never ahead of the server, even when responses were slow. */
  safeNow(): number {
    if (!this.samples.length) return this.local();
    return this.local() + Math.max(...this.samples.map((s) => s.min));
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
