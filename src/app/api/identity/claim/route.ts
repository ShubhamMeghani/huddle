import { getIdentity } from '@/server/identity';
import { fail, handle, ok } from '@/server/http';
import { claimGuest } from '@/server/claim';

/** "Claim my guest games" (R3): needs a signed-in user and this device's guest cookie. */
export async function POST() {
  return handle(async () => {
    const identity = await getIdentity();
    if (!identity || identity.kind !== 'user') return fail('UNAUTHORIZED');
    const result = await claimGuest(identity.guestId, identity.id);
    return ok(result);
  });
}
