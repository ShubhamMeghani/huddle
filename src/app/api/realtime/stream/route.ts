import { localBus, channelName } from '@/server/realtime';
import { realtimeDriverName } from '@/server/env';
import { q } from '@/server/db';
import { normalizeCode } from '@/lib/codes';

export const dynamic = 'force-dynamic';

/** Local realtime driver over SSE (test mode and CI only). Carries public data only. */
export async function GET(req: Request) {
  if (realtimeDriverName() !== 'local') return new Response('Not found', { status: 404 });
  const code = normalizeCode(new URL(req.url).searchParams.get('code'));
  if (!code) return new Response('Not found', { status: 404 });
  const rows = await q<{ id: string }>(
    'select id from rooms where code = $1 and ended_at is null and expires_at > now()',
    [code],
  );
  if (!rows[0]) return new Response('Not found', { status: 404 });
  const channel = channelName(rows[0].id);
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const write = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cleanup();
        }
      };
      const send = (msg: { name: string; data: unknown }) => write(`event: ${msg.name}\ndata: ${JSON.stringify(msg.data)}\n\n`);
      const ping = setInterval(() => write(': ping\n\n'), 15000);
      localBus().on(channel, send);
      cleanup = () => {
        clearInterval(ping);
        localBus().off(channel, send);
      };
      write(': connected\n\n');
      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
