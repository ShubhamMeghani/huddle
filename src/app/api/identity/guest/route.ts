import { ensureGuest } from '@/server/identity';
import { fail, handle, ok, readJson } from '@/server/http';
import { normalizeName } from '@/lib/names';

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const name = normalizeName(body.name);
    if (!name) return fail('INVALID', { message: 'Name must be 1–24 characters' });
    const identity = await ensureGuest(name);
    return ok({ identity: { id: identity.id, name: identity.name, kind: identity.kind } });
  });
}
