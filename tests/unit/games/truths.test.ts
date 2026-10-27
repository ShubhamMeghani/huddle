import { describe, expect, test } from 'vitest';
import { BOT_SETS, scoreVotes, validateEntry } from '@/games/truths/rules';
import { privateView, publicView } from '@/engine/room';
import { harness, startQueue, touchAll, type Harness } from '../../helpers/engine';

const ENTRIES: Record<string, { texts: string[]; lie: number }> = {
  A: { texts: ['I have a pet parrot', 'I was born in Pune', 'I have met the Prime Minister'], lie: 2 },
  B: { texts: ['I can play the flute', 'I have never been to Goa', 'I hate mangoes'], lie: 1 },
  C: { texts: ['I ran a marathon', 'I speak Tamil', 'I own 40 sneakers'], lie: 0 },
};

function game(): Harness {
  const h = harness(['A', 'B', 'C']);
  startQueue(h, [{ gameId: 'truths', settings: { writeSeconds: 120, voteSeconds: 25 } }]);
  return h;
}
const id = (h: Harness, n: string) => h.seat(n).id;
const toDeadline = (h: Harness) => {
  h.clock.advance(h.room.phase.deadline! - h.clock.now + 1);
  touchAll(h);
  h.tick();
};
/** Display position of a player's lie in the current (shuffled) order. */
const liePos = (h: Harness, n: string) => (h.room.game!.state.perm as number[]).indexOf(ENTRIES[n].lie);

describe('Two Truths & a Lie', () => {
  test('AC-102 entries need three different statements and a lie marked; the bot sets are valid', () => {
    expect(() => validateEntry(['a', 'b'], 0)).toThrow(/three statements/);
    expect(() => validateEntry(['a', ' ', 'c'], 0)).toThrow(/three statements/);
    expect(() => validateEntry(['Same', 'same!', 'c'], 0)).toThrow(/different/);
    expect(() => validateEntry(['a', 'b', 'c'], 3)).toThrow(/lie/);
    expect(() => validateEntry(['a', 'b', 'c'], null)).toThrow(/lie/);
    expect(validateEntry([' a ', 'b', 'c'], 1)).toEqual({ texts: ['a', 'b', 'c'], lie: 1 });
    expect(BOT_SETS.length).toBeGreaterThanOrEqual(10);
    for (const s of BOT_SETS) expect(() => validateEntry(s.texts, s.lie)).not.toThrow();
  });

  test('AC-102 scoring: +100 for spotting the lie, +50 to the author for each player fooled', () => {
    expect(scoreVotes('A', 2, { B: 2, C: 0, D: 1 })).toEqual({ A: 100, B: 100 });
    expect(scoreVotes('A', 0, {})).toEqual({ A: 0 });
  });

  test('AC-102 statements and lies stay secret: drafts are private, a turn shows only shuffled statements, the lie appears at the reveal', () => {
    const h = game();
    h.act('A', { type: 'fill', texts: ENTRIES.A.texts, lie: 2 });
    const pubW = JSON.stringify(publicView(h.room, {}, h.clock.now));
    expect(pubW).not.toContain('parrot');
    expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: id(h, 'B') }))).not.toContain('parrot');
    expect(privateView(h.room, { kind: 'player', seatId: id(h, 'A') }).game!.mine).toEqual({ texts: ENTRIES.A.texts, lie: 2 });
    for (const n of ['A', 'B', 'C']) h.act(n, { type: 'submit', ...ENTRIES[n] });
    expect(h.room.phase.kind).toBe('vote');
    expect(h.room.phase.turnSeatId).toBe(id(h, 'A'));
    const view = publicView(h.room, {}, h.clock.now).game!.view;
    expect([...view.statements].sort()).toEqual([...ENTRIES.A.texts].sort());
    expect(view.reveal).toBeNull();
    const pub = JSON.stringify(view);
    expect(pub).not.toMatch(/"lie"/);
    expect(pub).not.toContain('pet parrot","lie');
    // Nobody but A knows which one is the lie; B's other statements are not shown yet.
    expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: id(h, 'B') }))).not.toMatch(/"mylie":\d/i);
    expect(privateView(h.room, { kind: 'player', seatId: id(h, 'A') }).game!.myLie).toBe(liePos(h, 'A'));
    expect(pub).not.toContain('flute');
  });

  test('AC-102 each author in turn: the others vote (not the author, once each), early end, reveal and scores', () => {
    const h = game();
    for (const n of ['A', 'B', 'C']) h.act(n, { type: 'submit', ...ENTRIES[n] });
    // A's turn: B spots the lie, C is fooled.
    expect(() => h.act('A', { type: 'vote', choice: 0 })).toThrow(/own statements/);
    h.act('B', { type: 'vote', choice: liePos(h, 'A') });
    expect(() => h.act('B', { type: 'vote', choice: 0 })).toThrow(/Already voted/);
    expect(publicView(h.room, {}, h.clock.now).game!.view.votedIds).toEqual([id(h, 'B')]);
    h.act('C', { type: 'vote', choice: (liePos(h, 'A') + 1) % 3 });
    expect(h.room.phase.kind).toBe('reveal');
    const reveal = publicView(h.room, {}, h.clock.now).game!.view.reveal;
    expect(reveal.lie).toBe(liePos(h, 'A'));
    expect(reveal.points).toEqual({ [id(h, 'A')]: 50, [id(h, 'B')]: 100 });
    toDeadline(h);
    // B's turn: nobody votes before the deadline → missed turns, no points.
    expect(h.room.phase.turnSeatId).toBe(id(h, 'B'));
    toDeadline(h);
    expect(h.room.phase.kind).toBe('reveal');
    expect(h.seat('A').missedTurns).toBe(1);
    toDeadline(h);
    // C's turn: both spot it.
    h.act('A', { type: 'vote', choice: liePos(h, 'C') });
    h.act('B', { type: 'vote', choice: liePos(h, 'C') });
    toDeadline(h);
    expect(h.room.status).toBe('break');
    expect([h.seat('A').score, h.seat('B').score, h.seat('C').score]).toEqual([150, 200, 0]);
    expect(h.room.lastGame!.rows.find((r) => r.name === 'B')!.stats).toMatchObject({ liesSpotted: 2 });
  });

  test('AC-102 players who don’t submit are skipped (missed turn); with nobody submitting the game just ends', () => {
    const h = game();
    h.act('A', { type: 'submit', ...ENTRIES.A });
    toDeadline(h);
    expect(h.room.game!.state.order).toEqual([id(h, 'A')]);
    expect(h.seat('B').missedTurns).toBe(1);
    const h2 = game();
    toDeadline(h2);
    expect(h2.room.status).toBe('break');
  });
});
