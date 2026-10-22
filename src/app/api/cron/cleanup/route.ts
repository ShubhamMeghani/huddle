import { q } from '@/server/db';
import { handle, ok } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Daily: retire expired rooms and drop their transient rows (strokes, presence, old action log). */
export async function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    await q('update rooms set ended_at = now() where ended_at is null and expires_at <= now()');
    const s = await q('delete from strokes where room_id in (select id from rooms where ended_at is not null) returning 1');
    await q('delete from presence where room_id in (select id from rooms where ended_at is not null)');
    await q("delete from room_actions where created_at < now() - interval '2 days'");
    return ok({ strokesDeleted: s.length });
  });
}
