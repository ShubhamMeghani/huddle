/* Design tokens (R36, R91). globals.css mirrors these values; a unit test keeps them in sync and checks contrast. */

export const THEMES = {
  light: {
    bg: '#fff7ed',
    bg2: '#fdebd8',
    surface: '#ffffff',
    surface2: '#f6f0ff',
    ink: '#1b1530',
    muted: '#554d6b',
    line: '#e6dcf2',
    brand: '#6d28d9',
    onBrand: '#ffffff',
    accentSoft: '#efe7ff',
    danger: '#b4123c',
    onDanger: '#ffffff',
    success: '#0b7a45',
    warn: '#8a5300',
  },
  dark: {
    bg: '#110d1f',
    bg2: '#1a1430',
    surface: '#1e1834',
    surface2: '#272043',
    ink: '#f6f3ff',
    muted: '#c3bbdc',
    line: '#3a3160',
    brand: '#b79cff',
    onBrand: '#160f2a',
    accentSoft: '#2c2350',
    danger: '#ff7a9b',
    onDanger: '#1a0610',
    success: '#5ee2a0',
    warn: '#ffc566',
  },
} as const;

export type ThemeName = keyof typeof THEMES;
export type TokenName = keyof (typeof THEMES)['light'];

/** Per-game colour identity: accent, readable text on it, and a soft tint. */
export const GAME_ACCENTS = {
  quiz: { light: { accent: '#1d4ed8', on: '#ffffff', soft: '#e0e9ff', ink: '#1d4ed8' }, dark: { accent: '#7aa2ff', on: '#0b1330', soft: '#1b2650', ink: '#7aa2ff' } },
  charades: { light: { accent: '#ff2e88', on: '#1a0010', soft: '#ffe3f0', ink: '#b0105e' }, dark: { accent: '#ff6aa8', on: '#22000f', soft: '#3a1328', ink: '#ff6aa8' } },
  draw: { light: { accent: '#ffc400', on: '#1f1600', soft: '#fff4c2', ink: '#7a5800' }, dark: { accent: '#ffd23f', on: '#1f1600', soft: '#3a3010', ink: '#ffd23f' } },
  atlas: { light: { accent: '#0b7a45', on: '#ffffff', soft: '#dcf7e8', ink: '#0b7a45' }, dark: { accent: '#3fd68a', on: '#04180d', soft: '#10331f', ink: '#3fd68a' } },
  imposter: { light: { accent: '#7c3aed', on: '#ffffff', soft: '#efe5ff', ink: '#6d28d9' }, dark: { accent: '#b28bff', on: '#160a30', soft: '#2a1d4d', ink: '#b28bff' } },
  mlt: { light: { accent: '#ff7a00', on: '#1f0d00', soft: '#ffe8d2', ink: '#9a4400' }, dark: { accent: '#ff9a3d', on: '#1f0d00', soft: '#3a220c', ink: '#ff9a3d' } },
  npat: { light: { accent: '#0891b2', on: '#01161c', soft: '#cffafe', ink: '#0e7490' }, dark: { accent: '#22d3ee', on: '#04222b', soft: '#0c3640', ink: '#22d3ee' } },
  emoji: { light: { accent: '#65a30d', on: '#0f1a00', soft: '#ecfccb', ink: '#3f6212' }, dark: { accent: '#a3e635', on: '#142000', soft: '#24320c', ink: '#a3e635' } },
} as const;

/** Text-on-background pairs used by the UI. `large` marks pairs only used for large/bold text or UI glyphs (≥ 3:1). */
export const TEXT_PAIRS: { fg: TokenName; bg: TokenName; large?: boolean }[] = [
  { fg: 'ink', bg: 'bg' },
  { fg: 'ink', bg: 'bg2' },
  { fg: 'ink', bg: 'surface' },
  { fg: 'ink', bg: 'surface2' },
  { fg: 'ink', bg: 'accentSoft' },
  { fg: 'muted', bg: 'bg' },
  { fg: 'muted', bg: 'surface' },
  { fg: 'muted', bg: 'surface2' },
  { fg: 'onBrand', bg: 'brand' },
  { fg: 'onDanger', bg: 'danger' },
  { fg: 'danger', bg: 'surface' },
  { fg: 'danger', bg: 'bg' },
  { fg: 'success', bg: 'surface' },
  { fg: 'warn', bg: 'surface' },
  { fg: 'brand', bg: 'bg', large: true },
  { fg: 'bg', bg: 'ink' }, // notices and the reconnecting pill (inverted)
];

/** Avatar background colours: 12, unique per room. */
export const AVATAR_BG = ['#FF4D6D', '#FF8A00', '#FFC300', '#9BD600', '#00B86B', '#00C2C7', '#1E90FF', '#FFB3C1', '#8A2BE2', '#E040FB', '#8B5A2B', '#37474F'];

/* ── colour maths ── */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 colour difference. */
export function deltaE2000(h1: string, h2: string): number {
  const [L1, a1, b1] = toLab(h1);
  const [L2, a2, b2] = toLab(h2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    const h = Math.atan2(b, a) / rad;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2);
  const Lm = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hm += h1p + h2p < 360 ? 360 : -360;
    hm /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp;
  const Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
