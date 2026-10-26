import { describe, expect, test } from 'vitest';
import { privateView, publicView } from '@/engine/room';
import { GAME_META } from '@/games/meta';
import { harness, startQueue, touchAll } from '../helpers/engine';
import { GAMES } from '../helpers/drive';

const quiz = [{ gameId: 'quiz' as const, settings: { questions: 2, seconds: 10, categories: ['science'], difficulty: 'any', mode: 'solo' } }];

function introRoom(bots: string[] = []) {
  const h = harness(['A', 'B', 'C'], { bots });
  h.room.intros = true;
  return h;
}

describe('How-to-play card (R95)', () => {
  test('AC-90 every game has a card with exactly three short lines and one example', () => {
    for (const id of GAMES) {
      const intro = GAME_META[id].intro!;
      expect(intro, id).toBeDefined();
      expect(intro.lines).toHaveLength(3);
      for (const line of intro.lines) expect(line.length, `${id}: ${line}`).toBeLessThanOrEqual(80);
      expect(intro.example.length).toBeGreaterThan(10);
      expect(intro.example.length).toBeLessThanOrEqual(130);
    }
  });

  test('AC-90 the card comes before the first round; game actions wait; the game starts once every active human taps Got it', () => {
    const h = introRoom(['Bot']);
    startQueue(h, quiz);
    expect(h.room.status).toBe('playing');
    expect(h.room.phase.kind).toBe('intro');
    const pub = publicView(h.room, {}, h.clock.now);
    expect(pub.game!.view).toBeNull();
    expect(pub.game!.intro).toEqual({ ready: [] });
    expect(() => h.act('B', { type: 'answer', choice: 0 })).toThrow(/WRONG_PHASE/);
    h.act('A', { type: 'introReady' });
    h.act('A', { type: 'introReady' }); // idempotent
    expect(privateView(h.room, { kind: 'player', seatId: h.seat('A').id }).game).toMatchObject({ mustAct: false, introReady: true });
    h.act('B', { type: 'introReady' });
    expect(h.room.phase.kind).toBe('intro');
    // The bot never blocks the card; the last human's tap starts question 1.
    h.act('C', { type: 'introReady' });
    expect(h.room.phase.kind).toBe('question');
    expect(h.room.game!.intro).toBeNull();
    expect(publicView(h.room, {}, h.clock.now).game!.view).not.toBeNull();
  });

  test('AC-90 AFK players do not block the card, and it ends by itself when its timer runs out', () => {
    const h = introRoom();
    h.seat('C').afk = true;
    startQueue(h, quiz);
    h.act('A', { type: 'introReady' });
    h.act('B', { type: 'introReady' });
    expect(h.room.phase.kind).toBe('question');

    const h2 = introRoom();
    startQueue(h2, quiz);
    h2.clock.advance(h2.room.phase.deadline! - h2.clock.now + 1);
    touchAll(h2);
    h2.tick();
    expect(h2.room.phase.kind).toBe('question');
  });

  test('AC-90 the admin can skip the card, and the game can be ended during it', () => {
    const h = introRoom();
    startQueue(h, quiz);
    h.act('A', { type: 'skip' });
    expect(h.room.phase.kind).toBe('question');

    const h2 = harness(['A', 'B']);
    h2.room.intros = true;
    startQueue(h2, [{ gameId: 'draw', settings: { rounds: 1, drawSeconds: 30, hints: 2, words: 'mixed' } }]);
    expect(h2.room.phase.kind).toBe('intro');
    h2.act('A', { type: 'endGame' });
    expect(h2.room.status).toBe('break');
    expect(h2.room.lastGame?.gameId).toBe('draw');
  });

  test('AC-90 once seen in a room, a game never shows its card again (rematch, later queue entries); other games still do', () => {
    const h = introRoom();
    startQueue(h, [...quiz, ...quiz, { gameId: 'mlt', settings: { rounds: 3, voteSeconds: 10, selfVote: false } }]);
    expect(h.room.phase.kind).toBe('intro');
    h.act('A', { type: 'skip' });
    h.act('A', { type: 'endGame' });
    h.act('A', { type: 'rematch' });
    expect(h.room.phase.kind).toBe('question');
    h.act('A', { type: 'endGame' });
    h.act('A', { type: 'continue' }); // second quiz in the queue
    expect(h.room.game!.id).toBe('quiz');
    expect(h.room.phase.kind).toBe('question');
    h.act('A', { type: 'endGame' });
    h.act('A', { type: 'continue' });
    expect(h.room.game!.id).toBe('mlt');
    expect(h.room.phase.kind).toBe('intro');
  });

  test('AC-90 the admin can turn the cards off in the lobby; only the admin, and only outside a game', () => {
    const h = introRoom();
    expect(() => h.act('B', { type: 'setIntros', on: false })).toThrow(/NOT_ADMIN/);
    h.act('A', { type: 'setIntros', on: false });
    expect(publicView(h.room, {}, h.clock.now).intros).toBe(false);
    startQueue(h, quiz);
    expect(h.room.phase.kind).toBe('question');
    expect(() => h.act('A', { type: 'setIntros', on: true })).toThrow(/WRONG_PHASE/);
  });
});
