/* Drawing-throughput probe (SPEC §7 P1-5, AC-81).
 * Replays a synthetic 80 s drawing (pointer at 60 Hz, batched every 200 ms, RDP-simplified) into a
 * room on BASE, with 6 viewer subscribers and 1 screen-like subscriber. Records publishes/s,
 * message sizes, delivery latency, errors and (with Ably) app stats; appends to docs/deploy-checks.md.
 * Prints no secrets. Usage: DEPLOY_URL=https://… npm run probe:draw   (default http://localhost:3000) */
import { appendFileSync, existsSync } from 'node:fs';
import * as Ably from 'ably';
import { Client } from './lib/http';
import { encodePoints, quantize, rdp, type Pt, type StrokeOp } from '../src/lib/strokes';

const BASE = process.env.DEPLOY_URL ?? 'http://localhost:3000';
const DURATION_MS = Number(process.env.PROBE_MS ?? 80_000);
const FLUSH_MS = 200;
const SUBSCRIBERS = 7; // 6 viewers + 1 big screen

if (existsSync('.env.local') && !process.env.ABLY_API_KEY) process.loadEnvFile('.env.local');

interface Batch {
  at: number;
  ops: StrokeOp[];
}

/** Deterministic synthetic drawing: pen-down strokes of 1–3 s with short pauses, sampled at 60 Hz and
 *  flushed on a fixed 200 ms grid exactly like the canvas client (one batch per tick, ≤ 5 per second). */
function synthesize(): Batch[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const samples: { t: number; id: string; pt: Pt }[] = [];
  let t = 0;
  let strokeNo = 0;
  while (t < DURATION_MS) {
    const len = 1000 + rand() * 2000;
    const id = `p${strokeNo++}`;
    const cx = 200 + rand() * 600;
    const cy = 150 + rand() * 450;
    const r = 40 + rand() * 120;
    for (let s = 0; s < len && t < DURATION_MS; s += 1000 / 60, t += 1000 / 60) {
      const a = (s / len) * Math.PI * 2;
      samples.push({ t, id, pt: quantize([cx + r * Math.cos(a) + 15 * Math.sin(a * 5), cy + r * Math.sin(a) * 0.8]) });
    }
    t += 300 + rand() * 700;
  }
  const batches: Batch[] = [];
  const segNo = new Map<string, number>();
  const lastPt = new Map<string, Pt>();
  for (let tick = FLUSH_MS; tick <= DURATION_MS + FLUSH_MS; tick += FLUSH_MS) {
    const inTick = samples.filter((s) => s.t < tick && s.t >= tick - FLUSH_MS);
    if (!inTick.length) continue;
    const ops: StrokeOp[] = [];
    for (const id of [...new Set(inTick.map((s) => s.id))]) {
      const prev = lastPt.get(id);
      const pts = [...(prev ? [prev] : []), ...inTick.filter((s) => s.id === id).map((s) => s.pt)];
      lastPt.set(id, pts[pts.length - 1]);
      if (pts.length < 2) continue;
      const seg = segNo.get(id) ?? 0;
      segNo.set(id, seg + 1);
      ops.push({ k: 's', id, seg, c: Number(id.slice(1)) % 12, w: 1, e: false, p: encodePoints(rdp(pts)) });
    }
    if (ops.length) batches.push({ at: tick, ops });
  }
  return batches;
}

async function main() {
  const admin = new Client(BASE);
  await admin.req('/api/identity/guest', { method: 'POST', body: { name: 'Probe' } });
  const room = await admin.req('/api/rooms', { method: 'POST', body: {} });
  if (!room.json?.ok) throw new Error(`could not create room: ${room.status}`);
  const code = room.json.code as string;
  const snap = await admin.req(`/api/rooms/${code}/snapshot`);
  const driver = snap.json.realtime.driver as 'ably' | 'local';
  const channel = snap.json.realtime.channel as string;

  const sendTimes = new Map<number, number>();
  const latencies: number[] = [];
  let delivered = 0;
  const closers: (() => void)[] = [];

  for (let i = 0; i < SUBSCRIBERS; i++) {
    const v = new Client(BASE);
    await v.req('/api/identity/guest', { method: 'POST', body: { name: `Viewer${i + 1}` } });
    await v.req(`/api/rooms/${code}/join`, { method: 'POST', body: { spectate: i === SUBSCRIBERS - 1 } });
    const onMsg = (seq: number) => {
      delivered++;
      const t0 = sendTimes.get(seq);
      if (t0) latencies.push(Date.now() - t0);
    };
    if (driver === 'ably') {
      const rt = new Ably.Realtime({
        authCallback: async (_p, cb) => {
          try {
            const r = await v.req(`/api/realtime/token?code=${code}`);
            cb(null, r.json);
          } catch (e) {
            cb(String(e), null);
          }
        },
      });
      await new Promise<void>((res) => rt.connection.once('connected', () => res()));
      await rt.channels.get(channel).subscribe('strokes', (m) => onMsg(m.data.seq));
      closers.push(() => rt.close());
    } else {
      const ctl = new AbortController();
      const res = await fetch(`${BASE}/api/realtime/stream?code=${code}`, { headers: { Cookie: v.cookies() }, signal: ctl.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      void (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i2;
            while ((i2 = buf.indexOf('\n\n')) >= 0) {
              const chunk = buf.slice(0, i2);
              buf = buf.slice(i2 + 2);
              if (chunk.startsWith('event: strokes')) onMsg(JSON.parse(chunk.split('\ndata: ')[1]).seq);
            }
          }
        } catch {}
      })();
      closers.push(() => ctl.abort());
    }
  }

  const batches = synthesize();
  const start = Date.now();
  const results: { status: number; at: number; bytes: number }[] = [];
  await Promise.all(
    batches.map(
      (b, seq) =>
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            const bytes = Buffer.byteLength(JSON.stringify(b.ops));
            sendTimes.set(seq, Date.now());
            const post = () => admin.req(`/api/rooms/${code}/strokes`, { method: 'POST', body: { turnId: 'lobby', seq, ops: b.ops } }).catch(() => ({ status: 0, json: null }));
            let r = await post();
            if (r.status === 429 || r.status === 0) {
              await new Promise((w) => setTimeout(w, 400)); // client behaviour: retry once, same seq (idempotent)
              r = await post();
            }
            results.push({ status: r.status, at: Date.now() - start, bytes });
            resolve();
          }, b.at);
        }),
    ),
  );
  await new Promise((r) => setTimeout(r, 4000));
  closers.forEach((c) => c());

  const okCount = results.filter((r) => r.status === 200).length;
  const rateLimited = results.filter((r) => r.status === 429).length;
  const errors = results.filter((r) => r.status !== 200 && r.status !== 429).length;
  const perSecond = new Map<number, number>();
  for (const r of results.filter((x) => x.status === 200)) perSecond.set(Math.floor(r.at / 1000), (perSecond.get(Math.floor(r.at / 1000)) ?? 0) + 1);
  const maxPerSec = Math.max(0, ...perSecond.values());
  const avgPerSec = okCount / (DURATION_MS / 1000);
  const maxBytes = Math.max(...results.map((r) => r.bytes));
  const sorted = latencies.slice().sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN;
  const expectedDeliveries = okCount * SUBSCRIBERS;
  // Projection: 3-hour night, 8 players + 1 screen (9 subscribers), 24 drawing turns of 80 s.
  const perTurnMessages = okCount * (1 + 9);
  const perNight = perTurnMessages * 24;

  let stats = 'n/a (local driver)';
  if (driver === 'ably' && process.env.ABLY_API_KEY) {
    try {
      const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY });
      const page = await rest.stats({ unit: 'minute', limit: 3 });
      const total = page.items.reduce((s, it) => s + Number((it as any).entries?.['messages.all.all.count'] ?? 0), 0);
      stats = `${total} messages in the last 3 minutes (app stats; stats lag ~1 min)`;
    } catch (e) {
      stats = `stats unavailable: ${e instanceof Error ? e.message : 'error'}`;
    }
  }

  const lines = [
    '',
    `### Drawing-throughput probe · ${new Date().toISOString()} · ${BASE.includes('localhost') ? 'local production build' : 'production'} · driver ${driver}`,
    '',
    `| Metric | Value | Budget |`,
    `|---|---|---|`,
    `| Batches posted / accepted | ${results.length} / ${okCount} | – |`,
    `| Publishes per second (avg / max) | ${avgPerSec.toFixed(2)} / ${maxPerSec} | ≤ 5 avg; server cap 8 |`,
    `| Largest batch | ${maxBytes} B | ≤ 8 KB (Ably max 64 KiB) |`,
    `| Rate-limited (429) / other errors | ${rateLimited} / ${errors} | 0 / 0 |`,
    `| Deliveries received / expected | ${delivered} / ${expectedDeliveries} | equal |`,
    `| Delivery latency p50 / p95 | ${p(0.5)} ms / ${p(0.95)} ms | p95 ≤ 1000 ms on production |`,
    `| Projected Ably messages per 3 h, 8-player night | ≈ ${perNight.toLocaleString('en-US')} (${((perNight / 6_000_000) * 100).toFixed(2)} % of 6 M) | ≤ 5 % |`,
    `| Ably app stats | ${stats} | – |`,
    '',
  ];
  appendFileSync('docs/deploy-checks.md', lines.join('\n'));
  console.log(lines.join('\n'));
  const pass = errors === 0 && rateLimited === 0 && avgPerSec <= 5 && maxBytes <= 8192 && perNight / 6_000_000 <= 0.05;
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('probe failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
