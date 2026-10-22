import { describe, expect, test } from 'vitest';
import { guessedPoints, STEAL_POINTS } from '@/games/charades/rules';
import { privateView, publicView } from '@/engine/room';
import { harness, startQueue, touchAll } from '../../helpers/engine';

const settings = (extra: Record<string, unknown> = {}) => ({
  rounds: 2,
  seconds: 90,
  passes: 1,
  industries: ['bollywood', 'hollywood'],
  eras: ['classic', 'golden', 'modern'],
  difficulty: 'any',
  steal: false,
  ...extra,
});

function setup(extra: Record<string, unknown> = {}) {
  const h = harness(['A', 'B', 'C', 'D']);
  h.act('A', { type: 'setTeams', mode: 'shuffle', count: 2 });
  startQueue(h, [{ gameId: 'charades', settings: settings(extra) }]);
  return h;
}
type S = { teamId: string; actorId: string; movieId: string; passesLeft: number };
const cs = (h: ReturnType<typeof harness>) => h.room.game!.state as S;
const actor = (h: ReturnType<typeof harness>) => h.room.seats.find((s) => s.id === cs(h).actorId)!;

describe('Dumb Charades rules', () => {
  test('AC-61 scoring is 10 + 1 per full 10 s left', () => {
    expect(guessedPoints(90_000)).toBe(19);
    expect(guessedPoints(45_500)).toBe(14);
    expect(guessedPoints(9_999)).toBe(10);
    expect(guessedPoints(0)).toBe(10);
  });

  test('AC-61 only the actor sees the title; Guessed scores the team; actors rotate within each team', () => {
    const h = setup();
    const t1 = cs(h).teamId;
    const a1 = cs(h).actorId;
    const title = privateView(h.room, { kind: 'player', seatId: a1 }).game!.movie.title as string;
    for (const s of h.room.seats.filter((x) => x.id !== a1)) expect(JSON.stringify(privateView(h.room, { kind: 'player', seatId: s.id }))).not.toContain(title);
    expect(JSON.stringify(publicView(h.room, {}, h.clock.now))).not.toContain(title);
    expect(() => h.act(h.room.seats.find((s) => s.id !== a1)!, { type: 'guessed' })).toThrow(/NOT_YOUR_TURN/);
    h.clock.advance(30_000);
    touchAll(h);
    h.act(actor(h), { type: 'guessed' });
    expect(h.room.teamScores[t1]).toBe(16);
    expect(h.room.phase.kind).toBe('reveal');
    expect(JSON.stringify(publicView(h.room, {}, h.clock.now))).toContain(title);
    // Next turn is the other team; then team 1 again with its other member.
    h.clock.advance(2_501);
    touchAll(h);
    h.tick();
    expect(cs(h).teamId).not.toBe(t1);
    h.act(actor(h), { type: 'guessed' });
    h.clock.advance(2_501);
    touchAll(h);
    h.tick();
    expect(cs(h).teamId).toBe(t1);
    expect(cs(h).actorId).not.toBe(a1);
  });

  test('AC-61 pass limit is enforced and a timeout scores 0', () => {
    const h = setup();
    const t1 = cs(h).teamId;
    const first = cs(h).movieId;
    h.act(actor(h), { type: 'pass' });
    expect(cs(h).movieId).not.toBe(first);
    expect(() => h.act(actor(h), { type: 'pass' })).toThrow(/No passes left/);
    h.clock.advance(90_001);
    touchAll(h);
    h.tick();
    expect(h.room.phase.kind).toBe('reveal');
    expect(h.room.teamScores[t1]).toBe(0);
  });

  test('AC-61 with the steal rule a timeout opens a steal window; the marked team gets 5', () => {
    const h = setup({ steal: true });
    const t1 = cs(h).teamId;
    h.clock.advance(90_001);
    touchAll(h);
    h.tick();
    expect(h.room.phase.kind).toBe('steal');
    const other = h.room.teams!.find((t) => t.id !== t1)!.id;
    h.act(actor(h), { type: 'steal', teamId: other });
    expect(h.room.teamScores[other]).toBe(STEAL_POINTS);
    expect(h.room.phase.kind).toBe('reveal');
  });

  test('AC-61 the game ends after the configured rounds with teams ranked', () => {
    const h = setup({ rounds: 1 });
    const first = cs(h).teamId;
    h.act(actor(h), { type: 'guessed' }); // first team scores
    h.clock.advance(2_501);
    touchAll(h);
    h.tick();
    h.clock.advance(90_001); // second team times out
    touchAll(h);
    h.tick();
    h.clock.advance(2_501);
    touchAll(h);
    h.tick();
    expect(h.room.status).toBe('break');
    const winners = h.room.lastGame!.rows.filter((r) => r.rank === 1);
    expect(new Set(winners.map((r) => r.teamId))).toEqual(new Set([first]));
    expect(h.room.lastGame!.teamGame).toBe(true);
  });
});
