/**
 * Generates SomaShare PWA icons (forest green rounded square,
 * cream serif "S" with an orange vault-bookmark accent).
 * Run: node scripts/gen-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

const svg = (size) => {
  const pad = size * 0.1;
  const radius = size * 0.22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="512" height="512" rx="${(radius / size) * 512}" fill="#175334"/>
  <!-- open book base -->
  <path d="M96 352 C160 316, 224 316, 248 340 L248 148 C224 124, 160 124, 96 160 Z"
        fill="none" stroke="#FAF8F2" stroke-width="18" stroke-linejoin="round"/>
  <path d="M416 352 C352 316, 288 316, 264 340 L264 148 C288 124, 352 124, 416 160 Z"
        fill="none" stroke="#FAF8F2" stroke-width="18" stroke-linejoin="round"/>
  <!-- vault bookmark -->
  <path d="M392 96 L392 208 L366 180 L340 208 L340 96 Z" fill="#D96F32"/>
  <!-- serif S -->
  <text x="256" y="268" font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="210" fill="#FAF8F2" text-anchor="middle">S</text>
</svg>`;
};

const out = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const jobs = [192, 512, 180].map(async (size) => {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  await sharp(Buffer.from(svg(size)))
    .resize(size, size)
    .png()
    .toFile(out + name);
  console.log("wrote", name);
});

await Promise.all(jobs);

// maskable icon (full-bleed safe zone)
await sharp(
  Buffer.from(
    `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#175334"/>
      <path d="M96 352 C160 316, 224 316, 248 340 L248 148 C224 124, 160 124, 96 160 Z" fill="none" stroke="#FAF8F2" stroke-width="18"/>
      <path d="M416 352 C352 316, 288 316, 264 340 L264 148 C288 124, 352 124, 416 160 Z" fill="none" stroke="#FAF8F2" stroke-width="18"/>
      <path d="M392 96 L392 208 L366 180 L340 208 L340 96 Z" fill="#D96F32"/>
      <text x="256" y="268" font-family="Georgia, serif" font-weight="700" font-size="200" fill="#FAF8F2" text-anchor="middle">S</text>
    </svg>`
  )
)
  .png()
  .toFile(out + "maskable-512.png");
console.log("wrote maskable-512.png");
