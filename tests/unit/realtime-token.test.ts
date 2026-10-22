import { describe, expect, test } from 'vitest';
import { tokenRequest, channelName } from '@/server/realtime';
import { SENTINELS } from '../helpers/sentinels';

describe('Ably token requests', () => {
  test('AC-5 capability is exactly subscribe on the room channel, TTL ≤ 60 min, no secret inside', async () => {
    const tr = await tokenRequest('room-123', 'identity-abc', SENTINELS.ABLY_API_KEY);
    expect(JSON.parse(tr.capability as string)).toEqual({ [channelName('room-123')]: ['subscribe'] });
    expect(tr.ttl).toBeLessThanOrEqual(3_600_000);
    expect(tr.clientId).toBe('identity-abc');
    expect(tr.keyName).toBe('SNTLAPP.SNTLKEY');
    expect(JSON.stringify(tr)).not.toContain('sentinel-ably-secret');
    expect(tr.mac).toBeTruthy();
  });
});
