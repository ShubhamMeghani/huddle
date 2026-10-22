import { getIdentity } from '@/server/identity';
import { handle, ok } from '@/server/http';
import { googleEnabled, isTestMode } from '@/server/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const identity = await getIdentity();
    return ok({
      identity: identity ? { id: identity.id, name: identity.name, kind: identity.kind, guestId: identity.guestId } : null,
      google: googleEnabled(),
      testSignIn: isTestMode(),
    });
  });
}
