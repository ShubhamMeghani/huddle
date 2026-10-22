'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSync } from '@/client/sync';
import { CANVAS_H, CANVAS_W, PALETTE, SIZES, encodePoints, quantize, rdp, replay, type Pt, type StrokeOp } from '@/lib/strokes';

export interface Tool {
  color: number;
  size: number;
  eraser: boolean;
}

/** Canonical fingerprint of the op log (field order fixed: Postgres jsonb reorders object keys). */
function digest(ops: StrokeOp[]): string {
  const s = JSON.stringify(ops.map((o) => (o.k === 's' ? ['s', o.id, o.seg, o.c, o.w, o.e, o.p] : o.k === 'u' ? ['u', o.id] : ['c'])));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return `${ops.length}:${h.toString(16)}`;
}

/** Shared canvas for Draw & Guess (R69, R70). Drawers draw; everyone else (and the big screen) watches. */
export function DrawCanvas({
  sync,
  code,
  turnId,
  isDrawer,
  tool,
  onApi,
}: {
  sync: RoomSync;
  code: string;
  turnId: string;
  isDrawer: boolean;
  tool: Tool;
  onApi?: (api: { undo: () => void; clear: () => void }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const batches = useRef(new Map<number, StrokeOp[]>()); // committed, by seq
  const pending = useRef<StrokeOp[]>([]); // drawer: not yet sent
  const live = useRef<{ id: string; seg: number; pts: Pt[]; sentUpTo: number } | null>(null);
  const seq = useRef(0);
  const strokeIds = useRef<string[]>([]);
  const [stamp, setStamp] = useState({ count: 0, digest: '0:811c9dc5' });
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const committedOps = useCallback(() => {
    const keys = [...batches.current.keys()].sort((a, b) => a - b);
    return keys.flatMap((k) => batches.current.get(k)!);
  }, []);

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const scale = c.width / CANVAS_W;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const ops = [...committedOps(), ...pending.current];
    const lv = live.current;
    const strokes = replay(ops);
    if (lv && lv.pts.length) {
      const existing = strokes.find((s) => s.id === lv.id);
      const extra = lv.pts.slice(lv.sentUpTo);
      if (existing) existing.pts.push(...extra);
      else strokes.push({ id: lv.id, c: toolRef.current.color, w: toolRef.current.size, e: toolRef.current.eraser, pts: lv.pts.slice() });
    }
    for (const s of strokes) {
      ctx.strokeStyle = s.e ? '#ffffff' : PALETTE[s.c] ?? '#000';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = (SIZES[s.w] ?? 10) * scale;
      if (s.pts.length === 1) {
        ctx.beginPath();
        ctx.arc(s.pts[0][0] * scale, s.pts[0][1] * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0] * scale, s.pts[0][1] * scale);
      // Quadratic smoothing through segment midpoints.
      for (let i = 1; i < s.pts.length - 1; i++) {
        const mx = ((s.pts[i][0] + s.pts[i + 1][0]) / 2) * scale;
        const my = ((s.pts[i][1] + s.pts[i + 1][1]) / 2) * scale;
        ctx.quadraticCurveTo(s.pts[i][0] * scale, s.pts[i][1] * scale, mx, my);
      }
      const last = s.pts[s.pts.length - 1];
      ctx.lineTo(last[0] * scale, last[1] * scale);
      ctx.stroke();
    }
    const committed = committedOps();
    setStamp({ count: committed.length, digest: digest(committed) });
  }, [committedOps]);

  /* ── sizing ── */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const w = c.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(((w * CANVAS_H) / CANVAS_W) * dpr);
      render();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    // Older iOS ignores touch-action on canvases: block scrolling/zooming while drawing (R69).
    const block = (e: TouchEvent) => e.preventDefault();
    c.addEventListener('touchmove', block, { passive: false });
    c.addEventListener('touchstart', block, { passive: false });
    return () => {
      ro.disconnect();
      c.removeEventListener('touchmove', block);
      c.removeEventListener('touchstart', block);
    };
  }, [render]);

  /* ── receiving: initial load, live messages, gap catch-up ── */
  const fetchAfter = useCallback(
    async (after: number) => {
      const res = await fetch(`/api/rooms/${code}/strokes?turnId=${encodeURIComponent(turnId)}&after=${after}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!body?.ok) return;
      for (const b of body.batches as { seq: number; ops: StrokeOp[] }[]) batches.current.set(b.seq, b.ops);
      if (isDrawer) seq.current = Math.max(seq.current, ...[...batches.current.keys()].map((k) => k + 1), 0);
      render();
    },
    [code, turnId, isDrawer, render],
  );

  useEffect(() => {
    batches.current = new Map();
    pending.current = [];
    live.current = null;
    seq.current = 0;
    strokeIds.current = [];
    render();
    void fetchAfter(-1);
    const off = sync.onStrokes((msg) => {
      if (msg.turnId !== turnId || batches.current.has(msg.seq)) return;
      const maxSeq = Math.max(-1, ...batches.current.keys());
      batches.current.set(msg.seq, msg.ops as StrokeOp[]);
      render();
      if (msg.seq > maxSeq + 1) void fetchAfter(maxSeq); // gap: catch up (SPEC §4.5)
    });
    return () => {
      off();
    };
  }, [turnId, sync, fetchAfter, render]);

  /* ── drawing (drawer only) ── */
  const send = useCallback(
    async (ops: StrokeOp[]) => {
      const mySeq = seq.current++;
      batches.current.set(mySeq, ops);
      pending.current = pending.current.filter((o) => !ops.includes(o));
      render();
      const post = () =>
        fetch(`/api/rooms/${code}/strokes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turnId, seq: mySeq, ops }),
        });
      const r = await post().catch(() => null);
      if (!r || r.status === 429 || r.status >= 500) {
        await new Promise((w) => setTimeout(w, 400));
        await post().catch(() => null); // same seq: idempotent
      }
    },
    [code, turnId, render],
  );

  const flush = useCallback(() => {
    const lv = live.current;
    const ops: StrokeOp[] = [];
    if (lv && lv.pts.length - lv.sentUpTo >= 1) {
      const from = Math.max(0, lv.sentUpTo - 1); // overlap one point so segments join
      const segPts = lv.pts.slice(from);
      if (segPts.length >= 2 || lv.sentUpTo === 0) {
        const t = toolRef.current;
        const pts = segPts.length >= 2 ? rdp(segPts) : [segPts[0], segPts[0]];
        ops.push({ k: 's', id: lv.id, seg: lv.seg++, c: t.color, w: t.size, e: t.eraser, p: encodePoints(pts) });
        lv.sentUpTo = lv.pts.length;
      }
    }
    const queued = pending.current.slice();
    if (queued.length || ops.length) void send([...queued, ...ops].slice(0, 64));
  }, [send]);

  useEffect(() => {
    if (!isDrawer) return;
    const t = setInterval(() => {
      if (live.current && live.current.pts.length > live.current.sentUpTo) flush();
    }, 200);
    return () => clearInterval(t);
  }, [isDrawer, flush]);

  const toLogical = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return quantize([((e.clientX - r.left) / r.width) * CANVAS_W, ((e.clientY - r.top) / r.height) * CANVAS_H]);
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const id = `${Date.now().toString(36)}${strokeIds.current.length}`;
    strokeIds.current.push(id);
    live.current = { id, seg: 0, pts: [toLogical(e)], sentUpTo: 0 };
    render();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const lv = live.current;
    if (!isDrawer || !lv) return;
    e.preventDefault();
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of list) {
      const p = quantize([((ev.clientX - r.left) / r.width) * CANVAS_W, ((ev.clientY - r.top) / r.height) * CANVAS_H]);
      const last = lv.pts[lv.pts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) lv.pts.push(p);
    }
    if (lv.pts.length - lv.sentUpTo >= 64) flush();
    render();
  };
  const up = () => {
    if (!isDrawer || !live.current) return;
    flush();
    live.current = null;
    render();
  };

  useEffect(() => {
    onApi?.({
      undo: () => {
        const id = strokeIds.current.pop();
        if (!id) return;
        pending.current.push({ k: 'u', id });
        flush();
      },
      clear: () => {
        strokeIds.current = [];
        pending.current.push({ k: 'c' });
        flush();
      },
    });
  }, [onApi, flush]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full rounded-2xl border-2 border-line bg-white"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={(e) => {
        if (e.buttons === 0) up();
      }}
      aria-label={isDrawer ? 'Drawing canvas: draw your word here' : 'The drawing'}
      role="img"
      data-testid="draw-canvas"
      data-op-count={stamp.count}
      data-op-digest={stamp.digest}
    />
  );
}
