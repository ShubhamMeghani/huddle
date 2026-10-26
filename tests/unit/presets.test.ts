import { expect, test } from 'vitest';
import { GAME_META } from '@/games/meta';
import { applyPreset, estimateMinutes, hasPresets, PRESET_NAMES, presetOf } from '@/games/presets';
import { defaultsOf, validateSettings } from '@/games/settings';
import { GAMES } from '../helpers/drive';

for (const id of GAMES) {
  test(`AC-94 ${id}: Quick, Normal and Long are valid house rules, Normal is the defaults, and each is recognised`, () => {
    expect(hasPresets(id)).toBe(true);
    const spec = GAME_META[id].settings;
    const defaults = defaultsOf(spec);
    expect(applyPreset(id, defaults, 'normal')).toEqual(defaults);
    expect(presetOf(id, defaults)).toBe('normal');
    for (const n of PRESET_NAMES) {
      const s = applyPreset(id, defaults, n);
      expect(validateSettings(spec, s)).toEqual(s); // production ranges, not test-mode minimums
      expect(presetOf(id, s)).toBe(n);
    }
    expect(applyPreset(id, defaults, 'quick')).not.toEqual(applyPreset(id, defaults, 'long'));
  });

  test(`AC-94 ${id}: estimates are whole minutes and grow from Quick to Normal to Long`, () => {
    const defaults = defaultsOf(GAME_META[id].settings);
    for (const players of [4, 8]) {
      const [q, n, l] = PRESET_NAMES.map((p) => estimateMinutes(id, applyPreset(id, defaults, p), players));
      for (const m of [q, n, l]) {
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(1);
      }
      expect(q, `${id} quick < normal at ${players}`).toBeLessThan(n);
      expect(n, `${id} normal < long at ${players}`).toBeLessThan(l);
    }
  });
}

test('AC-94 presets change only rounds and timers: categories and house rules picked under Advanced are kept; other timers read as Custom', () => {
  const custom = { ...defaultsOf(GAME_META.quiz.settings), categories: ['cricket'], difficulty: 'hard' };
  const quick = applyPreset('quiz', custom, 'quick');
  expect(quick).toMatchObject({ categories: ['cricket'], difficulty: 'hard', questions: 5, seconds: 15 });
  expect(presetOf('quiz', quick)).toBe('quick');
  expect(presetOf('quiz', { ...quick, seconds: 25 })).toBeNull();
});
