// Rasterize the app icon to the PNG sizes the manifest + iOS need.
// Run: node scripts/gen-icons.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
await mkdir(dir, { recursive: true });
const svg = await readFile(fileURLToPath(new URL('./icon.svg', import.meta.url)));

const targets = [
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'icon-maskable-512.png', size: 512, pad: 64 }, // safe-zone padding
  { name: 'apple-touch-icon.png', size: 180, pad: 0 },
];

for (const t of targets) {
  const inner = t.size - t.pad * 2;
  const scaled = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: t.size,
      height: t.size,
      channels: 4,
      background: t.pad ? { r: 12, g: 107, b: 98, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, top: t.pad, left: t.pad }])
    .png()
    .toFile(dir + t.name);
  console.log('wrote', t.name);
}
