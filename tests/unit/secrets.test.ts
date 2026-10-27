import { describe, expect, test } from 'vitest';
import { privateView, publicView } from '@/engine/room';
import { BANK } from '@/games/quiz/rules';
import { MOVIES } from '@/games/charades/rules';
import type { RoomState } from '@/engine/types';
import { botRoom, drive, GAMES } from '../helpers/drive';

const pv = (room: RoomState) => JSON.stringify(publicView(room, {}, Date.now())).toLowerCase();
const priv = (room: RoomState, seatId: string) => JSON.stringify(privateView(room, { kind: 'player', seatId })).toLowerCase();
const has = (json: string, text: string) => json.includes(JSON.stringify(text.toLowerCase()));

describe('AC-38 secrets never reach viewers who may not see them (every phase of every game)', () => {
  for (const id of GAMES) {
    test(`AC-38 ${id}`, () => {
      const h = botRoom(id, 6);
      let checked = 0;
      drive(h, (room) => {
        if (room.status !== 'playing' || !room.game) return;
        const g = room.game.state as any;
        const kind = room.phase.kind;
        const pub = pv(room);
        const screen = JSON.stringify(privateView(room, { kind: 'screen' })).toLowerCase();
        checked++;
        switch (id) {
          case 'quiz': {
            if (kind === 'question') {
              expect(JSON.parse(pub).game.view.reveal).toBeNull();
              expect(pub).not.toMatch(/"answer"|"correct"/);
            }
            void BANK;
            break;
          }
          case 'draw': {
            if (kind !== 'choose' && kind !== 'draw') break;
            const secrets = [...(g.choices as string[]), ...(g.word ? [g.word] : [])];
            for (const w of secrets) {
              expect(has(pub, w), `public view leaks ${w}`).toBe(false);
              expect(has(screen, w)).toBe(false);
              for (const s of room.seats) {
                const entitled = s.id === g.drawerId || (g.guessed as { seatId: string }[]).some((x) => x.seatId === s.id);
                if (!entitled) expect(has(priv(room, s.id), w), `${s.name} sees ${w}`).toBe(false);
              }
            }
            break;
          }
          case 'charades': {
            if (kind !== 'act' && kind !== 'steal') break;
            const title = MOVIES.find((m) => m.id === g.movieId)!.title;
            expect(has(pub, title)).toBe(false);
            for (const s of room.seats) if (s.id !== g.actorId) expect(has(priv(room, s.id), title)).toBe(false);
            break;
          }
          case 'imposter': {
            if (kind === 'reveal') break;
            expect(has(pub, g.crewWord)).toBe(false);
            expect(has(pub, g.imposterWord)).toBe(false);
            expect(pub).not.toContain('"imposters"');
            for (const s of room.seats) {
              const mine = (g.imposters as string[]).includes(s.id) ? g.imposterWord : g.crewWord;
              const other = mine === g.crewWord ? g.imposterWord : g.crewWord;
              expect(has(priv(room, s.id), other), `${s.name} sees the other word`).toBe(false);
            }
            break;
          }
          case 'mlt': {
            // Views never carry a voter → votee map; after the tally the state no longer has one either.
            expect(pub).not.toMatch(/"votes":\{"s\d+"/);
            for (const s of room.seats) expect(priv(room, s.id)).not.toMatch(/"votes":\{|"myvote"/);
            if (kind === 'reveal') expect(Object.keys(g.votes)).toHaveLength(0);
            break;
          }
          case 'npat': {
            // While writing, nobody but the author sees an answer.
            if (kind !== 'write') break;
            for (const [author, answers] of Object.entries(g.answers as Record<string, Record<string, string>>)) {
              for (const text of Object.values(answers).filter((t) => t.trim().length > 2)) {
                expect(has(pub, text), `public view leaks ${text}`).toBe(false);
                expect(has(screen, text)).toBe(false);
                for (const s of room.seats) {
                  // A seat that wrote the same answer itself is entitled to see it.
                  const own = Object.values((g.answers as Record<string, Record<string, string>>)[s.id] ?? {}).some((t) => t.trim().toLowerCase() === text.trim().toLowerCase());
                  if (s.id !== author && !own) expect(has(priv(room, s.id), text), `${s.name} sees ${text}`).toBe(false);
                }
              }
            }
            break;
          }
          default:
            break;
        }
      });
      expect(checked).toBeGreaterThan(5);
    });
  }
});
