/* Generates content/bot-drawings.json: simple parametric sketches the demo bots "draw" (R44).
 * Deterministic output; every word must exist in content/draw-words.json. */
import { writeFileSync } from 'node:fs';
import { encodePoints, quantize, rdp, type Pt, type StrokeOp } from '../src/lib/strokes';

type Shape = { c: number; w: number; pts: Pt[] };

const circle = (cx: number, cy: number, r: number, ry = r, from = 0, to = Math.PI * 2, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + r * Math.cos(a), cy + ry * Math.sin(a)];
  });
const line = (...pts: Pt[]): Pt[] => pts;
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const star = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });

const BLACK = 0, RED = 3, ORANGE = 4, YELLOW = 5, GREEN = 6, TEAL = 7, BLUE = 8, PURPLE = 9, PINK = 10, BROWN = 11;

const DRAWINGS: Record<string, Shape[]> = {
  sun: [{ c: YELLOW, w: 2, pts: circle(500, 375, 120) }, ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return { c: ORANGE, w: 1, pts: line([500 + 150 * Math.cos(a), 375 + 150 * Math.sin(a)], [500 + 230 * Math.cos(a), 375 + 230 * Math.sin(a)]) };
  })],
  house: [{ c: BROWN, w: 1, pts: rect(330, 350, 340, 280) }, { c: RED, w: 1, pts: line([300, 360], [500, 170], [700, 360]) }, { c: BLACK, w: 1, pts: rect(460, 480, 80, 150) }],
  tree: [{ c: BROWN, w: 2, pts: rect(470, 420, 60, 250) }, { c: GREEN, w: 2, pts: circle(500, 320, 170, 140) }],
  star: [{ c: YELLOW, w: 2, pts: star(500, 380, 260) }],
  fish: [{ c: ORANGE, w: 2, pts: circle(470, 375, 200, 110) }, { c: ORANGE, w: 2, pts: line([660, 375], [800, 270], [800, 480], [660, 375]) }, { c: BLACK, w: 2, pts: circle(360, 350, 12) }],
  cup: [{ c: BLUE, w: 2, pts: line([360, 260], [390, 600], [610, 600], [640, 260], [360, 260]) }, { c: BLUE, w: 2, pts: circle(660, 420, 70, 90, -Math.PI / 2, Math.PI / 2) }],
  ball: [{ c: RED, w: 2, pts: circle(500, 375, 200) }, { c: RED, w: 1, pts: circle(500, 375, 200, 60) }],
  apple: [{ c: RED, w: 2, pts: circle(500, 400, 190, 200) }, { c: BROWN, w: 2, pts: line([500, 200], [520, 120]) }, { c: GREEN, w: 1, pts: circle(560, 150, 50, 25) }],
  flower: [...Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return { c: PINK, w: 2, pts: circle(500 + 90 * Math.cos(a), 300 + 90 * Math.sin(a), 60) };
  }), { c: YELLOW, w: 2, pts: circle(500, 300, 50) }, { c: GREEN, w: 2, pts: line([500, 360], [500, 700]) }],
  moon: [{ c: YELLOW, w: 2, pts: [...circle(500, 375, 220, 220, Math.PI / 2, Math.PI * 1.5), ...circle(560, 375, 170, 220, Math.PI * 1.5, Math.PI / 2, 30).reverse()] }],
  heart: [{ c: RED, w: 2, pts: Array.from({ length: 61 }, (_, i) => {
    const t = (i / 60) * Math.PI * 2;
    return [500 + 16 * 14 * Math.sin(t) ** 3, 360 - 14 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))] as Pt;
  }) }],
  cloud: [{ c: BLUE, w: 2, pts: [...circle(380, 420, 90, 90, Math.PI / 2, Math.PI * 1.6), ...circle(500, 330, 120, 110, Math.PI, Math.PI * 2), ...circle(630, 420, 90, 90, Math.PI * 1.4, Math.PI * 2.5), [380, 510]] }],
  rainbow: [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE].map((c, i) => ({ c, w: 2, pts: circle(500, 600, 380 - i * 40, 380 - i * 40, Math.PI, Math.PI * 2) })),
  umbrella: [{ c: PURPLE, w: 2, pts: [...circle(500, 380, 300, 200, Math.PI, Math.PI * 2), [200, 380]] }, { c: BLACK, w: 2, pts: line([500, 380], [500, 650], [460, 690], [430, 660]) }],
  boat: [{ c: BROWN, w: 2, pts: line([250, 500], [750, 500], [660, 620], [340, 620], [250, 500]) }, { c: BLACK, w: 1, pts: line([500, 500], [500, 150]) }, { c: RED, w: 2, pts: line([500, 170], [700, 450], [500, 450]) }],
  glasses: [{ c: BLACK, w: 2, pts: circle(370, 380, 110) }, { c: BLACK, w: 2, pts: circle(630, 380, 110) }, { c: BLACK, w: 2, pts: line([480, 370], [520, 370]) }],
  kite: [{ c: PINK, w: 2, pts: line([500, 120], [680, 330], [500, 560], [320, 330], [500, 120]) }, { c: BLACK, w: 1, pts: line([500, 560], [470, 620], [530, 660], [480, 720]) }],
  snowman: [{ c: BLUE, w: 2, pts: circle(500, 560, 150) }, { c: BLUE, w: 2, pts: circle(500, 320, 100) }, { c: ORANGE, w: 2, pts: line([500, 320], [580, 335], [500, 340]) }],
  pizza: [{ c: ORANGE, w: 2, pts: line([500, 650], [260, 180], [740, 180], [500, 650]) }, { c: RED, w: 2, pts: circle(450, 280, 35) }, { c: RED, w: 2, pts: circle(560, 300, 35) }, { c: RED, w: 2, pts: circle(500, 430, 35) }],
  'ice cream': [{ c: BROWN, w: 2, pts: line([400, 380], [500, 700], [600, 380]) }, { c: PINK, w: 2, pts: circle(500, 330, 120, 100) }],
  smile: [{ c: YELLOW, w: 2, pts: circle(500, 375, 260) }, { c: BLACK, w: 2, pts: circle(420, 300, 20) }, { c: BLACK, w: 2, pts: circle(580, 300, 20) }, { c: BLACK, w: 2, pts: circle(500, 400, 140, 110, 0.2, Math.PI - 0.2) }],
  diya: [{ c: ORANGE, w: 2, pts: [...circle(500, 480, 220, 110, 0, Math.PI), [280, 480], [720, 480]] }, { c: YELLOW, w: 2, pts: line([500, 470], [470, 380], [500, 280], [530, 380], [500, 470]) }],
  kabaddi: [{ c: BLACK, w: 1, pts: line([200, 650], [800, 650]) }, { c: BLACK, w: 1, pts: line([500, 150], [500, 650]) }, { c: TEAL, w: 2, pts: circle(350, 300, 40) }, { c: TEAL, w: 2, pts: line([350, 340], [350, 480], [300, 620]) }],
  ladoo: [{ c: ORANGE, w: 2, pts: circle(500, 400, 170) }, { c: YELLOW, w: 1, pts: circle(470, 360, 20) }, { c: YELLOW, w: 1, pts: circle(560, 430, 20) }],
};

const out: { word: string; ops: StrokeOp[] }[] = Object.entries(DRAWINGS).map(([word, shapes]) => ({
  word,
  ops: shapes.map((s, i) => ({ k: 's' as const, id: `b${i}`, seg: 0, c: s.c, w: s.w, e: false, p: encodePoints(rdp(s.pts.map(quantize))) })),
}));
writeFileSync('content/bot-drawings.json', '[\n' + out.map((d) => JSON.stringify(d)).join(',\n') + '\n]\n');
console.log(`bot-drawings.json: ${out.length} drawings`);
