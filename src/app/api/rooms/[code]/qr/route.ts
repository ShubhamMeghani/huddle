import QRCode from 'qrcode';
import { handle } from '@/server/http';
import { codeFrom, type CodeParams } from '@/server/params';

export async function GET(req: Request, params: CodeParams) {
  return handle(async () => {
    const code = await codeFrom(params);
    const url = new URL(req.url);
    const target = url.searchParams.get('screen') === '1' ? `${url.origin}/screen/${code}` : `${url.origin}/r/${code}`;
    const png = await QRCode.toBuffer(target, { type: 'png', margin: 2, width: 320, errorCorrectionLevel: 'M' });
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  });
}
