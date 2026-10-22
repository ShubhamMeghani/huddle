/* Small fetch helpers for pages outside a room. */

export async function postJson<T = any>(path: string, body: unknown = {}, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return res.json();
}

export async function getJson<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  return res.json();
}

export interface Me {
  identity: { id: string; name: string; kind: 'guest' | 'user'; guestId: string | null } | null;
  google: boolean;
  testSignIn: boolean;
}
