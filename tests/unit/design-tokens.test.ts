import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { AVATAR_BG, GAME_ACCENTS, TEXT_PAIRS, THEMES, contrast, deltaE2000 } from '@/lib/design-tokens';
import { AVATAR_COLORS } from '@/lib/avatars';

const css = readFileSync('src/app/globals.css', 'utf8').toLowerCase();
const cssVar: Record<string, string> = {
  bg: '--bg', bg2: '--bg-2', surface: '--surface', surface2: '--surface-2', ink: '--ink', muted: '--muted', line: '--line',
  brand: '--brand', onBrand: '--on-brand', accentSoft: '--accent-soft', danger: '--danger', onDanger: '--on-danger', success: '--success', warn: '--warn',
};

test('AC-83 every text/background pair meets WCAG AA in both themes (4.5:1, or 3:1 for large text)', () => {
  const failures: string[] = [];
  for (const [theme, t] of Object.entries(THEMES)) {
    for (const p of TEXT_PAIRS) {
      const ratio = contrast(t[p.fg], t[p.bg]);
      if (ratio < (p.large ? 3 : 4.5)) failures.push(`${theme} ${p.fg} on ${p.bg}: ${ratio.toFixed(2)}`);
    }
  }
  expect(failures).toEqual([]);
});

test('AC-83 every game accent has a paired text colour meeting 4.5:1, plus readable ink on its soft tint, in both themes', () => {
  const failures: string[] = [];
  for (const [game, themes] of Object.entries(GAME_ACCENTS)) {
    for (const theme of ['light', 'dark'] as const) {
      const g = themes[theme];
      const on = contrast(g.on, g.accent);
      if (on < 4.5) failures.push(`${game} ${theme} on-accent ${on.toFixed(2)}`);
      const soft = contrast(THEMES[theme].ink, g.soft);
      if (soft < 4.5) failures.push(`${game} ${theme} ink on soft ${soft.toFixed(2)}`);
      // Accent-coloured text uses the text-safe accent ink on every surface.
      for (const surface of ['bg', 'surface', 'surface2'] as const) {
        const c = contrast(g.ink, THEMES[theme][surface]);
        if (c < 4.5) failures.push(`${game} ${theme} accent-ink on ${surface} ${c.toFixed(2)}`);
      }
    }
  }
  expect(failures).toEqual([]);
  expect(new Set(Object.values(GAME_ACCENTS).map((g) => g.light.accent)).size).toBe(Object.keys(GAME_ACCENTS).length);
});

test('AC-83 the 12 avatar colours are pairwise distinct (CIEDE2000 ΔE ≥ 15)', () => {
  expect(AVATAR_BG).toHaveLength(12);
  expect(AVATAR_COLORS.map((c) => c.bg.toLowerCase())).toEqual(AVATAR_BG.map((c) => c.toLowerCase()));
  let min = Infinity;
  for (let i = 0; i < AVATAR_BG.length; i++) for (let j = i + 1; j < AVATAR_BG.length; j++) min = Math.min(min, deltaE2000(AVATAR_BG[i], AVATAR_BG[j]));
  expect(min).toBeGreaterThanOrEqual(15);
  expect(deltaE2000('#ff0000', '#ff0000')).toBe(0);
});

test('globals.css uses exactly these token values', () => {
  const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const darkStart = css.indexOf("[data-theme='dark'] {");
  const darkBlock = css.slice(darkStart, css.indexOf('}', darkStart));
  for (const [name, v] of Object.entries(THEMES.light)) expect(lightBlock, `light ${name}`).toContain(`${cssVar[name]}: ${v}`);
  for (const [name, v] of Object.entries(THEMES.dark)) if (name !== 'onBrand' || true) expect(darkBlock, `dark ${name}`).toContain(`${cssVar[name]}: ${v}`);
  for (const [game, g] of Object.entries(GAME_ACCENTS)) {
    expect(css).toContain(`[data-game='${game}'] { --accent: ${g.light.accent}; --on-accent: ${g.light.on}; --accent-soft: ${g.light.soft}; --accent-ink: ${g.light.ink}; }`);
    expect(css).toContain(`--accent: ${g.dark.accent}; --on-accent: ${g.dark.on}; --accent-soft: ${g.dark.soft}; --accent-ink: ${g.dark.ink};`);
  }
});
