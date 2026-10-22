/* Minimal cookie-jar HTTP client for scripts (probe). */
export class Client {
  private jar = new Map<string, string>();
  constructor(public base: string) {}

  private cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async req(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; json: any }> {
    const res = await fetch(this.base + path, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Cookie: this.cookieHeader() },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: 'manual',
    });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';');
      const i = pair.indexOf('=');
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    return { status: res.status, json };
  }

  cookies() {
    return this.cookieHeader();
  }
}
