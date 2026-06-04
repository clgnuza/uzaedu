/**
 * PWA ikon + splash + mağaza screenshot — scripts/brand/uzaedu-app-icon.svg
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const brandSvg = join(__dirname, "brand", "uzaedu-app-icon.svg");
const publicDir = join(root, "public");
const pwaDir = join(publicDir, "pwa");
mkdirSync(pwaDir, { recursive: true });
const svg = readFileSync(brandSvg);

function brandFrame(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#042f2e"/>
      <stop offset="45%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="32%" r="55%">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
</svg>`);
}

async function iconPng(size, out) {
  const pad = Math.round(size * 0.08);
  const inner = size - pad * 2;
  const icon = await sharp(svg, { density: 320 }).resize(inner, inner).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${Math.round(inner * 0.26)}" fill="white"/></svg>`,
  );
  const framed = await sharp(brandFrame(size, size)).png().toBuffer();
  await sharp(framed)
    .composite([
      { input: icon, top: pad, left: pad },
      { input: await sharp(mask).resize(size, size).png().toBuffer(), blend: "dest-in" },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function maskable(size, out) {
  const inner = Math.round(size * 0.55);
  const icon = await sharp(svg, { density: 320 }).resize(inner, inner).png().toBuffer();
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 13, g: 148, b: 136, alpha: 1 } },
  })
    .composite([{ input: icon, top: pad, left: pad }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function promoShot(w, h, out) {
  const iconSize = Math.round(Math.min(w, h) * 0.28);
  const icon = await sharp(svg, { density: 320 }).resize(iconSize, iconSize).png().toBuffer();
  const y = Math.round(h * 0.36 - iconSize / 2);
  const x = Math.round((w - iconSize) / 2);
  const titleSize = Math.round(Math.min(w, h) * 0.055);
  const subSize = Math.round(titleSize * 0.55);
  const labelY = y + iconSize + Math.round(h * 0.05);
  const labels = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="50%" y="${labelY}" text-anchor="middle" fill="#f8fafc" font-family="Segoe UI,system-ui,sans-serif" font-size="${titleSize}" font-weight="700">Uzaedu \u00d6\u011fretmen</text>
  <text x="50%" y="${labelY + subSize * 1.8}" text-anchor="middle" fill="#94a3b8" font-family="Segoe UI,system-ui,sans-serif" font-size="${subSize}" font-weight="500">Dijital okul y\u00f6netimi</text>
</svg>`,
  );
  await sharp(brandFrame(w, h))
    .composite([
      { input: icon, top: y, left: x },
      { input: await sharp(labels).png().toBuffer(), top: 0, left: 0 },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function splash(w, h, out) {
  await promoShot(w, h, out);
}

copyFileSync(brandSvg, join(pwaDir, "uzaedu-app-icon.svg"));
await iconPng(192, join(publicDir, "icon-192.png"));
await iconPng(512, join(publicDir, "icon-512.png"));
await maskable(512, join(pwaDir, "icon-maskable-512.png"));
await promoShot(720, 1280, join(pwaDir, "screenshot-narrow.png"));
await promoShot(1280, 720, join(pwaDir, "screenshot-wide.png"));
await splash(1290, 2796, join(pwaDir, "splash-iphone-15-pro-max.png"));
await splash(1170, 2532, join(pwaDir, "splash-iphone-14.png"));
await splash(1080, 1920, join(pwaDir, "splash-android-portrait.png"));
writeFileSync(join(pwaDir, ".generated"), new Date().toISOString());
console.log("PWA brand assets OK");
