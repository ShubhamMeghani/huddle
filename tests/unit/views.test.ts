import { expect, test } from 'vitest';
import { privateView, publicView } from '@/engine/room';
import { snapshotFor } from '@/server/rooms';
import { botRoom, drive, GAMES } from '../helpers/drive';

test('AC-15 the snapshot for a viewer equals the public view plus that viewer’s private view; unknown viewers get public only', () => {
  const h = botRoom('quiz', 4);
  const host = h.seat('Host');
  const identity = { id: host.identityId, kind: 'guest' as const, name: 'Host', aliases: [host.identityId], guestId: host.identityId };
  const snap = snapshotFor(h.room, h.presence, identity);
  expect(snap.me).toEqual(privateView(h.room, { kind: 'player', seatId: host.id }));
  expect(JSON.parse(JSON.stringify(snap.public))).toEqual(JSON.parse(JSON.stringify(publicView(h.room, h.presence, Date.now()))));
  const stranger = snapshotFor(h.room, h.presence, null);
  expect(stranger.me).toEqual(privateView(h.room, { kind: 'public' }));
  expect(stranger.me.seatId).toBeNull();
  expect(stranger.me.role).toBe('none');
});

for (const id of GAMES) {
  test(`AC-15 the public view of a 12-player ${id} game stays under 16 KB at every step`, () => {
    const h = botRoom(id, 12);
    let max = 0;
    drive(h, (room) => {
      max = Math.max(max, Buffer.byteLength(JSON.stringify(publicView(room, h.presence, h.clock.now))));
    });
    expect(max).toBeLessThanOrEqual(16 * 1024);
  });
}
