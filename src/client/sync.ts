/* Client-side room sync (SPEC §4.2 client rules). Framework-agnostic; React binds via useRoom. */
import { ServerClock } from './clock';
import type { PublicView, PrivateView } from '@/engine/room';

export type Connection = 'connecting' | 'live' | 'polling';

export interface RoomSnapshot {
  v: number;
  public: PublicView;
  me: PrivateView;
}

export interface SyncState {
  snapshot: RoomSnapshot | null;
  connection: Connection;
  error: string | null;
  testMode: boolean;
}

type StrokeListener = (msg: { turnId: string; seq: number; ops: unknown[] }) => void;

export interface ActResult {
  ok: boolean;
  code?: string;
  message?: string;
  v?: number;
  private?: Record<string, unknown> | null;
}

declare global {
  interface Window {
    __huddleDrop?: number;
    __huddleSync?: RoomSync;
  }
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class RoomSync {
  clock = new ServerClock();
  state: SyncState = { snapshot: null, connection: 'connecting', error: null, testMode: false };
  private heartbeatMs = 25_000;
  private listeners = new Set<() => void>();
  private strokeListeners = new Set<StrokeListener>();
  private stopped = false;
  private driver: 'ably' | 'local' | null = null;
  private es: EventSource | null = null;
  private ably: { close: () => void } | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private downTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private fetching: Promise<void> | null = null;
  private refetchQueued = false;
  private cleanups: (() => void)[] = [];

  constructor(
    public code: string,
    private opts: { screen?: boolean } = {},
  ) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStrokes(fn: StrokeListener) {
    this.strokeListeners.add(fn);
    return () => this.strokeListeners.delete(fn);
  }

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private async request(path: string, init?: RequestInit): Promise<any> {
    const t0 = Date.now();
    const extra: Record<string, string> = this.opts.screen ? { 'x-huddle-screen': '1' } : {};
    const res = await fetch(path, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...extra, ...(init?.headers ?? {}) } });
    const t1 = Date.now();
    const body = await res.json().catch(() => ({}));
    if (typeof body.serverNow === 'number') this.clock.addSample(t0, t1, body.serverNow);
    return body;
  }

  async start() {
    this.stopped = false;
    if (typeof window !== 'undefined') window.__huddleSync = this;
    await this.fetchSnapshot();
    if (this.stopped || !this.state.snapshot) return;
    this.connectRealtime();
    const onWake = () => {
      if (document.visibilityState === 'visible') void this.fetchSnapshot();
    };
    const onFocusOrOnline = () => void this.fetchSnapshot();
    const onOffline = () => this.markOffline();
    const onOnline = () => {
      if (this.es && this.es.readyState === EventSource.CLOSED) this.connectLocal();
      void this.fetchSnapshot().then(() => {
        // The stream may have survived the outage; if realtime is still connected we are live again.
        const ablyState = (this.ably as unknown as { connection?: { state?: string } } | null)?.connection?.state;
        if (this.es?.readyState === EventSource.OPEN || ablyState === 'connected') this.markLive();
      });
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    window.addEventListener('pageshow', onFocusOrOnline);
    this.cleanups.push(() => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      window.removeEventListener('pageshow', onFocusOrOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    });
    // Screens don't hold a seat, so they don't send presence heartbeats; they still resync on wake.
    if (!this.opts.screen) {
      this.heartbeatTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void this.heartbeat();
      }, this.heartbeatMs);
    }
  }

  stop() {
    this.stopped = true;
    this.es?.close();
    this.ably?.close();
    for (const t of [this.heartbeatTimer, this.pollTimer]) if (t) clearInterval(t);
    for (const t of [this.downTimer, this.tickTimer]) if (t) clearTimeout(t);
    for (const c of this.cleanups) c();
    this.cleanups = [];
  }

  /** Coalesces concurrent snapshot requests; a request made during a fetch triggers one more. */
  fetchSnapshot(): Promise<void> {
    if (this.fetching) {
      this.refetchQueued = true;
      return this.fetching;
    }
    this.fetching = (async () => {
      try {
        const body = await this.request(`/api/rooms/${this.code}/snapshot`);
        if (!body.ok) {
          this.set({ error: body.code ?? 'ERROR' });
          return;
        }
        this.driver = body.realtime?.driver ?? 'local';
        if (typeof body.heartbeatMs === 'number') this.heartbeatMs = body.heartbeatMs;
        const current = this.state.snapshot;
        if (!current || body.v >= current.v) {
          this.set({ snapshot: { v: body.v, public: body.public, me: body.me }, error: null, testMode: Boolean(body.testMode) });
        }
        this.scheduleTick();
      } catch {
        // Network error: polling/heartbeat will retry.
      } finally {
        this.fetching = null;
        if (this.refetchQueued) {
          this.refetchQueued = false;
          void this.fetchSnapshot();
        }
      }
    })();
    return this.fetching;
  }

  private log(name: string, data: unknown) {
    if (!this.state.testMode || typeof window === 'undefined') return;
    const w = window as unknown as { __huddleLog?: string[] };
    w.__huddleLog ??= [];
    w.__huddleLog.push(`${name} ${JSON.stringify(data)}`);
    if (w.__huddleLog.length > 2000) w.__huddleLog.shift();
  }

  private onStateMessage(data: { v: number; serverNow: number; public: PublicView; privateFor: string[] }) {
    this.log('state', data);
    if (this.state.testMode && typeof window !== 'undefined' && (window.__huddleDrop ?? 0) > 0) {
      window.__huddleDrop = (window.__huddleDrop ?? 0) - 1;
      return; // test hook: simulate a lost message
    }
    const cur = this.state.snapshot;
    if (!cur) return void this.fetchSnapshot();
    if (data.v <= cur.v) return;
    if (data.v === cur.v + 1) {
      this.set({ snapshot: { v: data.v, public: data.public, me: cur.me } });
      this.scheduleTick();
      if (cur.me.seatId && data.privateFor.includes(cur.me.seatId)) void this.fetchSnapshot();
      return;
    }
    void this.fetchSnapshot(); // version gap
  }

  private onStrokesMessage(data: { turnId: string; seq: number; ops: unknown[] }) {
    this.log('strokes', data);
    for (const l of this.strokeListeners) l(data);
  }

  private markLive() {
    if (this.downTimer) clearTimeout(this.downTimer);
    this.downTimer = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.set({ connection: 'live' });
  }

  /** The browser says the network is gone: show "Reconnecting…" now and keep trying by polling. */
  private markOffline() {
    if (this.downTimer) clearTimeout(this.downTimer);
    this.downTimer = null;
    if (!this.pollTimer) this.pollTimer = setInterval(() => void this.fetchSnapshot(), 3000);
    this.set({ connection: 'polling' });
  }

  private markDown() {
    if (this.downTimer || this.pollTimer) return;
    this.downTimer = setTimeout(() => {
      this.downTimer = null;
      this.set({ connection: 'polling' });
      this.pollTimer = setInterval(() => void this.fetchSnapshot(), 3000);
    }, 10_000);
  }

  private connectRealtime() {
    // Realtime counts as down until it actually connects: a stream stuck "connecting" also triggers polling (R16).
    this.markDown();
    // Test-mode hook: simulate a transport that is blocked entirely (WebKit can't intercept EventSource).
    try {
      if (this.state.testMode && localStorage.getItem('huddle-test-no-realtime') === '1') return;
    } catch {}
    if (this.driver === 'local') return this.connectLocal();
    void this.connectAbly();
  }

  private connectLocal() {
    const es = new EventSource(`/api/realtime/stream?code=${this.code}`);
    this.es = es;
    es.onopen = () => {
      this.markLive();
      void this.fetchSnapshot();
    };
    es.onerror = () => this.markDown();
    es.addEventListener('state', (ev) => this.onStateMessage(JSON.parse((ev as MessageEvent).data)));
    es.addEventListener('strokes', (ev) => this.onStrokesMessage(JSON.parse((ev as MessageEvent).data)));
  }

  private async connectAbly() {
    const Ably = await import('ably');
    const snap = this.state.snapshot;
    if (!snap || this.stopped) return;
    const client = new Ably.Realtime({ authUrl: `/api/realtime/token?code=${this.code}`, authMethod: 'GET' });
    this.ably = client;
    client.connection.on((change) => {
      if (change.current === 'connected') {
        this.markLive();
        void this.fetchSnapshot();
      } else if (['disconnected', 'suspended', 'failed', 'closed'].includes(change.current)) {
        this.markDown();
      }
    });
    const channel = client.channels.get(`huddle:room:${snap.public.roomId}`);
    await channel.subscribe((msg) => {
      if (msg.name === 'state') this.onStateMessage(msg.data);
      else if (msg.name === 'strokes') this.onStrokesMessage(msg.data);
    });
  }

  private async heartbeat() {
    const body = await this.request(`/api/rooms/${this.code}/heartbeat`, { method: 'POST' }).catch(() => null);
    if (body?.ok && this.state.snapshot && body.v > this.state.snapshot.v) void this.fetchSnapshot();
  }

  /** Report expired deadlines / due bot actions when the server's nextWakeAt passes (SPEC §4.3). */
  private scheduleTick() {
    if (this.tickTimer) clearTimeout(this.tickTimer);
    const wake = this.state.snapshot?.public.nextWakeAt;
    if (wake == null) return;
    const delay = Math.max(0, wake - this.clock.now()) + Math.floor(Math.random() * 300);
    this.tickTimer = setTimeout(async () => {
      const body = await this.request(`/api/rooms/${this.code}/tick`, { method: 'POST' }).catch(() => null);
      if (body?.ok && this.state.snapshot && body.v > this.state.snapshot.v) void this.fetchSnapshot();
      else if (body?.ok) this.tickTimer = setTimeout(() => this.scheduleTick(), 1000);
    }, Math.min(delay, 2 ** 31 - 1));
  }

  async act(type: string, payload: Record<string, unknown> = {}): Promise<ActResult> {
    const actionId = uuid();
    const send = () =>
      this.request(`/api/rooms/${this.code}/actions`, { method: 'POST', body: JSON.stringify({ actionId, type, payload }) });
    let body: ActResult;
    try {
      body = await send();
    } catch {
      body = await send().catch(() => ({ ok: false, code: 'NETWORK' })); // same actionId: safe retry
    }
    if (body.ok && this.state.snapshot && (body.v ?? 0) > this.state.snapshot.v + 1) void this.fetchSnapshot();
    if (!body.ok && body.code !== 'NETWORK') void this.fetchSnapshot();
    return body;
  }
}
