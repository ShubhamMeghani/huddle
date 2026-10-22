import { expect, test } from 'vitest';
import { GAME_META } from '@/games/meta';
import { defaultsOf, validateSettings } from '@/games/settings';
import { GAMES, botRoom } from '../helpers/drive';

for (const id of GAMES) {
  test(`AC-32 ${id}: defaults are valid, out-of-range values are rejected, and settings are locked during the game`, () => {
    const spec = GAME_META[id].settings;
    const defaults = defaultsOf(spec);
    expect(validateSettings(spec, defaults)).toEqual(defaults);
    expect(validateSettings(spec, {})).toEqual(defaults);
    for (const [key, f] of Object.entries(spec)) {
      if (f.type === 'int') {
        expect(() => validateSettings(spec, { ...defaults, [key]: f.min - 1 }), `${id}.${key} below min`).toThrow(/INVALID|must be/);
        expect(() => validateSettings(spec, { ...defaults, [key]: f.max + 1 }), `${id}.${key} above max`).toThrow(/must be/);
        expect(() => validateSettings(spec, { ...defaults, [key]: 1.5 })).toThrow();
      } else if (f.type === 'enum') {
        expect(() => validateSettings(spec, { ...defaults, [key]: 'nonsense' })).toThrow(/invalid/);
      } else if (f.type === 'multi') {
        expect(() => validateSettings(spec, { ...defaults, [key]: [] })).toThrow(/Pick at least/);
        expect(() => validateSettings(spec, { ...defaults, [key]: ['nonsense'] })).toThrow(/invalid/);
      } else {
        expect(() => validateSettings(spec, { ...defaults, [key]: 'yes' })).toThrow(/on or off/);
      }
    }
    const h = botRoom(id, 5);
    expect(() => h.act('Host', { type: 'setQueue', queue: [{ gameId: id, settings: defaults }] })).toThrow(/WRONG_PHASE/);
  });
}
