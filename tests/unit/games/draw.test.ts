import { describe, expect, test } from 'vitest';
import { DRAWER_POINTS, guesserPoints, hintFractions, maskOf, maxReveals, type DrawState } from '@/games/draw/rules';
import { fold, isClose } from '@/lib/text';
import { privateView, publicView } from '@/engine/room';
import { harness, startQueue, touchAll } from '../../helpers/engine';

const queue = (extra: Record<string, unknown> = {}) => [{ gameId: 'draw' as const, settings: { rounds: 1, drawSeconds: 80, hints: 2, words: 'mixed', ...extra } }];
const ds = (h: ReturnType<typeof harness>) => h.room.game!.state as DrawState;

describe('Draw & Guess rules', () => {
  test('AC-65 guesses ignore case, spaces and hyphens', () => {
    expect(fold('Auto Rickshaw')).toBe(fold('auto-rickshaw'));
    expect(fold('autorickshaw')).toBe(fold('AUTO RICKSHAW'));
  });

  test('AC-65 close guesses: distance 1, or 2 for words of 8+ letters', () => {
    expect(isClose('mangp', 'mango')).toBe(true);
    expect(isClose('mngp', 'mango')).toBe(false);
    expect(isClose('elephnat', 'elephant')).toBe(true); // 8 letters, distance 2
    expect(isClose('mango', 'mango')).toBe(false); // exact is not "close"
  });

  test('AC-65 hints never reveal more than half the letters', () => {
    expect(hintFractions(2)).toEqual([0.5, 0.75]);
    expect(maxReveals('cat')).toBe(1);
    expect(maxReveals('auto rickshaw')).toBe(6);
    expect(maskOf('ice cream', [0])).toEqual(['I', '_', '_', ' ', '_', '_', '_', '_', '_']);
  });

  test('AC-65 scoring: guesser 50 + up to 250 by speed; drawer 60 per correct guesser; early end when all guessed', () => {
    expect(guesserPoints(80_000, 80_000)).toBe(300);
    expect(guesserPoints(0, 80_000)).toBe(50);
    const h = harness(['Dr', 'G1', 'G2']);
    startQueue(h, queue());
    expect(h.room.phase.kind).toBe('choose');
    expect(ds(h).drawerId).toBe(h.seat('Dr').id);
    h.act('Dr', { type: 'choose', index: 0 });
    const word = ds(h).word!;
    h.clock.advance(20_000);
    touchAll(h);
    h.act('G1', { type: 'guess', text: word.toUpperCase() });
    expect(h.seat('G1').score).toBe(50 + Math.round((250 * 60_000) / 80_000));
    expect(h.seat('Dr').score).toBe(DRAWER_POINTS);
    expect(h.room.phase.kind).toBe('draw');
    h.act('G2', { type: 'guess', text: word });
    expect(h.room.phase.kind).toBe('turnEnd');
    expect(h.seat('Dr').score).toBe(2 * DRAWER_POINTS);
  });

  test('AC-65 hints reveal letters at 50 % and 75 % of the drawing time', () => {
    const h = harness(['Dr', 'G1']);
    startQueue(h, queue({ drawSeconds: 80 }));
    h.act('Dr', { type: 'choose', index: 0 });
    h.clock.advance(40_001);
    touchAll(h);
    h.tick();
    const n1 = ds(h).revealed.length;
    h.clock.advance(20_000);
    touchAll(h);
    h.tick();
    expect(ds(h).revealed.length).toBe(Math.min(2, maxReveals(ds(h).word!)));
    expect(n1).toBe(Math.min(1, maxReveals(ds(h).word!)));
    expect(h.room.phase.kind).toBe('draw');
    expect(h.room.phase.endsAt).toBe(ds(h).drawEndsAt);
  });

  test('AC-65 a word not chosen within the choose time skips the turn as a missed turn', () => {
    const h = harness(['Dr', 'G1']);
    startQueue(h, queue());
    h.clock.advance(4_001); // choose time is 15 s, shortened to 4 s in test mode
    h.presence['id-G1'] = h.clock.now;
    h.presence['id-Dr'] = h.clock.now;
    h.tick();
    expect(h.seat('Dr').missedTurns).toBe(1);
    expect(ds(h).drawerId).toBe(h.seat('G1').id);
  });

  test('AC-65 chat visibility: correct guessers chat privately; the drawer cannot chat; the word never reaches the public view', () => {
    const h = harness(['Dr', 'G1', 'G2', 'G3']);
    startQueue(h, queue());
    h.act('Dr', { type: 'choose', index: 0 });
    const word = ds(h).word!;
    expect(() => h.act('Dr', { type: 'guess', text: 'hello' })).toThrow(/drawer/i);
    h.act('G1', { type: 'guess', text: word });
    h.act('G1', { type: 'guess', text: 'so easy' });
    const pub = JSON.stringify(publicView(h.room, {}, h.clock.now));
    expect(pub.toLowerCase()).not.toContain(`"${word.toLowerCase()}"`);
    expect(pub).not.toContain('so easy');
    const g2 = privateView(h.room, { kind: 'player', seatId: h.seat('G2').id });
    expect(JSON.stringify(g2)).not.toContain('so easy');
    expect(JSON.stringify(g2).toLowerCase()).not.toContain(word.toLowerCase());
    const dr = privateView(h.room, { kind: 'player', seatId: h.seat('Dr').id });
    expect(JSON.stringify(dr)).toContain('so easy');
    const g1 = privateView(h.room, { kind: 'player', seatId: h.seat('G1').id });
    expect(JSON.stringify(g1)).toContain('so easy');
  });

  test('each seated player draws once per round, then the game ends with drawer stats', () => {
    const h = harness(['A', 'B']);
    startQueue(h, queue());
    for (const drawer of ['A', 'B']) {
      expect(ds(h).drawerId).toBe(h.seat(drawer).id);
      h.act(drawer, { type: 'choose', index: 1 });
      const other = drawer === 'A' ? 'B' : 'A';
      h.act(other, { type: 'guess', text: ds(h).word! });
      h.clock.advance(4_001);
      touchAll(h);
      h.tick();
    }
    expect(h.room.status).toBe('break');
    const a = h.room.lastGame!.rows.find((r) => r.name === 'A')!;
    expect(a.stats.drawTurns).toBe(1);
    expect(a.stats.drawerPoints).toBe(DRAWER_POINTS);
  });
});
