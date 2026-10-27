import { ImageResponse } from 'next/og';
import { q } from '@/server/db';

export const dynamic = 'force-dynamic';

const TITLES: Record<string, string> = {
  quiz: 'Quiz Clash',
  draw: 'Draw & Guess',
  imposter: 'Imposter',
  atlas: 'Atlas',
  charades: 'Dumb Charades',
  mlt: 'Most Likely To',
  npat: 'Name Place Animal Thing',
  ping: 'Ping',
};

interface Summary {
  games?: { gameId: string; winners: string[]; rows: { seatId: string; name: string; placementPoints: number; rank: number }[] }[];
}

/** Shareable recap card (R53): 1080 × 1350 PNG with the night's standings and awards. */
export async function GET(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return new Response('Not found', { status: 404 });
  const rows = await q<{ date_ist: string; awards: { award: string; name: string; detail: string }[]; summary: Summary }>(
    `select to_char(date_ist, 'DD Mon YYYY') as date_ist, awards, summary from nights where room_id = $1`,
    [roomId],
  );
  if (!rows[0]) return new Response('Not found', { status: 404 });
  const { date_ist, awards, summary } = rows[0];
  const totals = new Map<string, { name: string; points: number }>();
  for (const g of summary.games ?? []) {
    for (const r of g.rows ?? []) {
      const t = totals.get(r.seatId) ?? { name: r.name, points: 0 };
      t.points += r.placementPoints;
      totals.set(r.seatId, t);
    }
  }
  const standings = [...totals.values()].sort((a, b) => b.points - a.points).slice(0, 8);
  const colors = ['#ff2e88', '#1d4ed8', '#ffc400', '#0f8a4f', '#7c3aed', '#ff7a00', '#00c2c7', '#e040fb'];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff7ed', padding: 72, fontFamily: 'sans-serif', color: '#1b1530' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2 }}>Huddle.</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#554d6b' }}>{date_ist}</div>
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, marginTop: 8, color: '#6d28d9' }}>Game night recap</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
          {(summary.games ?? []).map((g, i) => (
            <div key={i} style={{ display: 'flex', fontSize: 28, fontWeight: 700, background: '#efe7ff', borderRadius: 999, padding: '8px 20px' }}>
              {TITLES[g.gameId] ?? g.gameId}: {g.winners.join(', ')}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, gap: 14 }}>
          {standings.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: 28, padding: '18px 28px', border: '4px solid #e6dcf2' }}>
              <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 999, background: colors[i % colors.length], alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 34, fontWeight: 900 }}>
                {i + 1}
              </div>
              <div style={{ display: 'flex', flex: 1, marginLeft: 24, fontSize: 44, fontWeight: 800 }}>{s.name}</div>
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 900 }}>{s.points}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, gap: 10 }}>
          {(awards ?? []).map((a, i) => (
            <div key={i} style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>
              <span style={{ fontWeight: 900, color: '#6d28d9', marginRight: 16 }}>{a.award}</span> {a.name} · {a.detail}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
