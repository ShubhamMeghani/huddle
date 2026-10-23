/* Generates the app icons (R41): a "huddle" of three colourful circles on the brand purple. Deterministic. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function icon(size: number, opts: { maskable?: boolean; rounded?: boolean } = {}): Buffer {
  const png = new PNG({ width: size, height: size });
  const bg = hex('#6d28d9');
  const radius = opts.rounded ? size * 0.22 : 0;
  // Maskable icons keep the art inside the central 80 % safe zone.
  const scale = opts.maskable ? 0.62 : 0.8;
  const c = size / 2;
  const r = (size * scale) / 4.2;
  const dots = [
    { x: c - r * 1.05, y: c + r * 0.6, color: hex('#ff2e88') },
    { x: c + r * 1.05, y: c + r * 0.6, color: hex('#ffc400') },
    { x: c, y: c - r * 0.95, color: hex('#1e90ff') },
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let inside = true;
      if (radius) {
        const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
        const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
        inside = dx * dx + dy * dy <= radius * radius;
      }
      let col = bg;
      for (const d of dots) if ((x - d.x) ** 2 + (y - d.y) ** 2 <= r * r) col = d.color;
      if ((x - c) ** 2 + (y - (c + r * 0.05)) ** 2 <= (r * 0.42) ** 2) col = [255, 255, 255];
      png.data[i] = col[0];
      png.data[i + 1] = col[1];
      png.data[i + 2] = col[2];
      png.data[i + 3] = inside ? 255 : 0;
    }
  }
  return PNG.sync.write(png);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icon(192, { rounded: true }));
writeFileSync('public/icons/icon-512.png', icon(512, { rounded: true }));
writeFileSync('public/icons/maskable-512.png', icon(512, { maskable: true }));
writeFileSync('public/icons/apple-touch-icon.png', icon(180)); // iOS rounds the corners itself
writeFileSync('public/favicon.png', icon(48, { rounded: true }));
console.log('icons written');
