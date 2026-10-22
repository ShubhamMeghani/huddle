import { describe, expect, test } from 'vitest';
import { checkPlace, lookup, nextLetter, PLACES } from '@/games/atlas/rules';
import { harness, startQueue } from '../../helpers/engine';

describe('Atlas validation', () => {
  test('AC-68 the place must start with the required letter', () => {
    expect(checkPlace('Delhi', 'd', 'any', new Set()).ok).toBe(true);
    expect(checkPlace('Delhi', 'm', 'any', new Set())).toEqual({ ok: false, reason: 'letter' });
    expect(checkPlace('Xyzzyville', 'x', 'any', new Set())).toEqual({ ok: false, reason: 'unknown' });
  });

  test('AC-68 used places are tracked by place, not spelling: Bombay after Mumbai is rejected', () => {
    const mumbai = checkPlace('Mumbai', 'm', 'any', new Set());
    expect(mumbai.ok).toBe(true);
    const used = new Set([(mumbai as { place: { id: string } }).place.id]);
    expect(checkPlace('Bombay', 'b', 'any', used)).toEqual({ ok: false, reason: 'used' });
  });

  test('AC-68 accents, case, spaces and punctuation are ignored: São Paulo == sao paulo', () => {
    expect(lookup('sao paulo').map((p) => p.name)).toContain('São Paulo');
    expect(lookup('SÃO-PAULO').map((p) => p.name)).toContain('São Paulo');
    expect(checkPlace('saopaulo', 's', 'any', new Set()).ok).toBe(true);
  });

  test('AC-68 India-only and Countries-only variants reject out-of-variant places', () => {
    expect(checkPlace('Paris', 'p', 'india', new Set())).toEqual({ ok: false, reason: 'variant' });
    expect(checkPlace('Pune', 'p', 'india', new Set()).ok).toBe(true);
    expect(checkPlace('Paris', 'p', 'countries', new Set())).toEqual({ ok: false, reason: 'variant' });
    expect(checkPlace('Peru', 'p', 'countries', new Set()).ok).toBe(true);
    expect(checkPlace('Kerala', 'k', 'countries', new Set())).toEqual({ ok: false, reason: 'variant' });
  });

  test('AC-68 the next letter is the last letter, falling back to the previous one when nothing unused starts with it', () => {
    expect(nextLetter('Delhi', 'any', new Set())).toBe('i');
    // Countries only: use up every country starting with "y" so "Germany" must fall back to "n".
    const yCountries = new Set(PLACES.filter((p) => p.kind === 'country' && p.name.toLowerCase().startsWith('y')).map((p) => p.id));
    expect(nextLetter('Germany', 'countries', yCountries)).toBe('n');
    expect(nextLetter('Germany', 'countries', new Set())).toBe('y');
  });

  test('AC-68 a full turn: accepted places score 10 and set the next letter; wrong ones can be retried', () => {
    const h = harness(['A', 'B']);
    startQueue(h, [{ gameId: 'atlas', settings: { seconds: 20, lives: 1, variant: 'any' } }]);
    const s = h.room.game!.state as { letter: string };
    s.letter = 'd';
    expect(() => h.act('A', { type: 'submit', text: 'Mumbai' })).toThrow(/Start with D/);
    h.act('A', { type: 'submit', text: 'Delhi' });
    expect(h.seat('A').score).toBe(10);
    expect(s.letter).toBe('i');
    expect(h.room.phase.turnSeatId).toBe(h.seat('B').id);
  });
});
