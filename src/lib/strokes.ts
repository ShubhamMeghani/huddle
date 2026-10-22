/* Drawing strokes (SPEC §4.5): 1000×750 logical canvas, integer points, delta encoding,
 * Ramer–Douglas–Peucker simplification. Pure; shared by the client, server, probe and tests. */

export const CANVAS_W = 1000;
export const CANVAS_H = 750;
export const RDP_EPSILON = 0.75;
export const PALETTE = [
  '#1b1530', '#ffffff', '#8a8a8a', '#e53935', '#ff8a00', '#ffc400',
  '#2ecc71', '#00a3a3', '#1e66ff', '#7c3aed', '#ff4fa3', '#8b5a2b',
] as const;
export const SIZES = [4, 10, 20, 40] as const;

export type Pt = [number, number];

export type StrokeOp =
  | { k: 's'; id: string; seg: number; c: number; w: number; e: boolean; p: number[] }
  | { k: 'u'; id: string }
  | { k: 'c' };

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Iterative RDP: keeps endpoints and every point farther than eps from its simplified chord. */
export function rdp(points: Pt[], eps = RDP_EPSILON): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function distToPolyline(p: Pt, line: Pt[]): number {
  if (line.length === 1) return Math.hypot(p[0] - line[0][0], p[1] - line[0][1]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, perpDist(p, line[i], line[i + 1]));
  return best;
}

/** Symmetric Hausdorff distance between two polylines (vertices against segments). */
export function hausdorff(a: Pt[], b: Pt[]): number {
  let d = 0;
  for (const p of a) d = Math.max(d, distToPolyline(p, b));
  for (const p of b) d = Math.max(d, distToPolyline(p, a));
  return d;
}

export function quantize(p: Pt): Pt {
  return [Math.max(0, Math.min(CANVAS_W, Math.round(p[0]))), Math.max(0, Math.min(CANVAS_H, Math.round(p[1])))];
}

export function encodePoints(pts: Pt[]): number[] {
  const out: number[] = [];
  let px = 0;
  let py = 0;
  pts.forEach(([x, y], i) => {
    if (i === 0) out.push(x, y);
    else out.push(x - px, y - py);
    px = x;
    py = y;
  });
  return out;
}

export function decodePoints(p: number[]): Pt[] {
  const out: Pt[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < p.length; i += 2) {
    if (i === 0) {
      x = p[0];
      y = p[1];
    } else {
      x += p[i];
      y += p[i + 1];
    }
    out.push([x, y]);
  }
  return out;
}

/** Validates an op list from the network (server side). */
export function validOps(ops: unknown): ops is StrokeOp[] {
  if (!Array.isArray(ops) || ops.length > 64) return false;
  return ops.every((o) => {
    if (!o || typeof o !== 'object') return false;
    const op = o as Record<string, unknown>;
    if (op.k === 'c') return true;
    if (op.k === 'u') return typeof op.id === 'string' && op.id.length <= 24;
    if (op.k !== 's') return false;
    return (
      typeof op.id === 'string' &&
      op.id.length <= 24 &&
      Number.isInteger(op.seg) &&
      Number.isInteger(op.c) &&
      (op.c as number) >= 0 &&
      (op.c as number) < PALETTE.length &&
      Number.isInteger(op.w) &&
      (op.w as number) >= 0 &&
      (op.w as number) < SIZES.length &&
      typeof op.e === 'boolean' &&
      Array.isArray(op.p) &&
      op.p.length >= 2 &&
      op.p.length % 2 === 0 &&
      op.p.length <= 400 &&
      op.p.every((n) => Number.isInteger(n) && Math.abs(n as number) <= 2000)
    );
  });
}

/** Turns a sequence of applied ops into the visible stroke list (undo removes a stroke; clear empties). */
export function replay(ops: StrokeOp[]): { id: string; c: number; w: number; e: boolean; pts: Pt[] }[] {
  const strokes = new Map<string, { id: string; c: number; w: number; e: boolean; pts: Pt[] }>();
  for (const op of ops) {
    if (op.k === 'c') strokes.clear();
    else if (op.k === 'u') strokes.delete(op.id);
    else {
      const pts = decodePoints(op.p);
      const s = strokes.get(op.id);
      if (s) s.pts.push(...pts);
      else strokes.set(op.id, { id: op.id, c: op.c, w: op.w, e: op.e, pts });
    }
  }
  return [...strokes.values()];
}
