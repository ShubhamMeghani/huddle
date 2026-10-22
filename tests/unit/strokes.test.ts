import { expect, test } from 'vitest';
import { decodePoints, encodePoints, hausdorff, quantize, rdp, RDP_EPSILON, replay, validOps, type Pt, type StrokeOp } from '@/lib/strokes';
import { seededRng } from '@/engine/rng';
import drawings from '../../content/bot-drawings.json';

/** Realistic finger strokes: smooth curves sampled at 60 Hz with slight hand jitter, quantised to the canvas grid. */
function syntheticStrokes(n: number): Pt[][] {
  const rng = seededRng('strokes');
  const out: Pt[][] = [];
  for (let k = 0; k < n; k++) {
    const len = 30 + Math.floor(rng() * 150);
    const cx = 100 + rng() * 800;
    const cy = 100 + rng() * 550;
    const r = 30 + rng() * 200;
    const turns = 0.3 + rng() * 1.5;
    const wobble = rng() * 30;
    const pts: Pt[] = [];
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = t * Math.PI * 2 * turns;
      pts.push(quantize([cx + r * Math.cos(a) + wobble * Math.sin(a * 7) + (rng() - 0.5), cy + r * 0.8 * Math.sin(a) + (rng() - 0.5)]));
    }
    out.push(pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]));
  }
  return out;
}

test('AC-64 simplification keeps every stroke within 1 unit and removes at least 40 % of points on average', () => {
  const strokes = syntheticStrokes(180);
  // "Recorded" fixtures: the hand-built bot drawings, re-densified to 60 Hz-like spacing.
  for (const d of drawings) {
    for (const op of d.ops as StrokeOp[]) {
      if (op.k !== 's') continue;
      const pts = decodePoints(op.p);
      const dense: Pt[] = [];
      for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 6; s++) dense.push(quantize([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * s) / 6, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * s) / 6]));
      dense.push(pts[pts.length - 1]);
      strokes.push(dense);
    }
  }
  expect(strokes.length).toBeGreaterThanOrEqual(200);
  let removed = 0;
  for (const s of strokes) {
    const simple = rdp(s, RDP_EPSILON);
    expect(hausdorff(s, simple)).toBeLessThanOrEqual(1);
    removed += 1 - simple.length / s.length;
  }
  expect(removed / strokes.length).toBeGreaterThanOrEqual(0.4);
});

test('AC-64 a full 64-point batch stays under 8 KB and encode/decode round-trips exactly', () => {
  const pts: Pt[] = Array.from({ length: 64 }, (_, i) => [1000 - i * 7, (i * 37) % 750]);
  const op: StrokeOp = { k: 's', id: 'abcdef123456', seg: 3, c: 11, w: 3, e: false, p: encodePoints(pts) };
  expect(Buffer.byteLength(JSON.stringify([op]))).toBeLessThanOrEqual(8 * 1024);
  expect(decodePoints(encodePoints(pts))).toEqual(pts);
  expect(validOps([op])).toBe(true);
  expect(validOps([{ ...op, c: 99 }])).toBe(false);
});

test('replay applies undo and clear in order', () => {
  const s = (id: string): StrokeOp => ({ k: 's', id, seg: 0, c: 0, w: 0, e: false, p: [1, 1, 2, 2] });
  expect(replay([s('a'), s('b'), { k: 'u', id: 'b' }]).map((x) => x.id)).toEqual(['a']);
  expect(replay([s('a'), { k: 'c' }, s('c')]).map((x) => x.id)).toEqual(['c']);
});
