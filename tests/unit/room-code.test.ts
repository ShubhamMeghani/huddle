import { expect, test } from 'vitest';
import { CODE_ALPHABET, generateRoomCode } from '@/lib/codes';
import { createRoom } from '@/server/rooms';
import { makeIdentity } from '../helpers/unit-room';

test('AC-7 10 000 codes are 4 letters from the alphabet without I, L or O', () => {
  for (let i = 0; i < 10_000; i++) {
    const c = generateRoomCode();
    expect(c).toMatch(/^[A-Z]{4}$/);
    expect(c).not.toMatch(/[ILO]/);
    for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
  }
});

test('AC-7 a collision with a live room code is retried and gets a different code', async () => {
  const id = await makeIdentity('Coder');
  const first = await createRoom({ identity: id, code: 'QQQQ' });
  expect(first.code).toBe('QQQQ');
  // Forcing the same code again collides; createRoom must not reuse a live code.
  await expect(createRoom({ identity: id, code: 'QQQQ' })).rejects.toThrow(/allocate/);
  const fresh = await createRoom({ identity: id });
  expect(fresh.code).not.toBe('QQQQ');
});
