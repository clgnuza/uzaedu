/**
 * PWA ikon + splash — seal halka merkez logosu (public/landing/uza-logo.png)
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sealLogo = join(root, 'public', 'landing', 'uza-logo.png');
const publicDir = join(root, 'public');
const pwaDir = join(publicDir, 'pwa');
mkdirSync(pwaDir, { recursive: true });

function brandFrame(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#1a0505"/>
      <stop offset="45%" stop-color="#050505"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="58%">
      <stop offset="0%" stop-color="#dc2626" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
</svg>`);
}

async function logoBuffer(size) {
  return sharp(sealLogo).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function iconPng(size, out) {
  const pad = Math.round(size * 0.04);
  const inner = size - pad * 2;
  const icon = await logoBuffer(inner);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${Math.round(inner * 0.22)}" fill="white"/></svg>`,
  );
  const framed = await sharp(brandFrame(size, size)).png().toBuffer();
  await sharp(framed)
    .composite([
      { input: icon, top: pad, left: pad },
      { input: await sharp(mask).resize(size, size).png().toBuffer(), blend: 'dest-in' },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function maskable(size, out) {
  const inner = Math.round(size * 0.78);
  const icon = await logoBuffer(inner);
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 5, g: 5, b: 5, alpha: 1 } },
  })
    .composite([{ input: icon, top: pad, left: pad }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function promoShot(w, h, out) {
  const portrait = h > w;
  const iconSize = Math.round(Math.min(w, h) * (portrait ? 0.22 : 0.26));
  const icon = await logoBuffer(iconSize);
  const titleSize = Math.round(Math.min(w, h) * (portrait ? 0.048 : 0.055));
  const subSize = Math.round(titleSize * 0.58);
  const cardW = portrait ? Math.round(w * 0.78) : Math.round(w * 0.42);
  const cardH = portrait ? Math.round(iconSize + titleSize * 4.2) : Math.round(iconSize + titleSize * 3.8);
  const cardX = Math.round((w - cardW) / 2);
  const cardY = portrait ? Math.round(h * 0.22) : Math.round((h - cardH) / 2);
  const card = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}">
  <defs>
    <linearGradient id="card" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#1a0505"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="${cardW}" height="${cardH}" rx="${Math.round(cardW * 0.08)}" fill="url(#card)" stroke="rgba(220,38,38,0.35)" stroke-width="2"/>
</svg>`,
  );
  const iconX = cardX + Math.round((cardW - iconSize) / 2);
  const iconY = cardY + Math.round(cardH * 0.12);
  const labelY = iconY + iconSize + Math.round(titleSize * 1.35);
  const labels = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="50%" y="${labelY}" text-anchor="middle" fill="#fafafa" font-family="Segoe UI,system-ui,sans-serif" font-size="${titleSize}" font-weight="700">Uzaedu \u00d6\u011fretmen</text>
  <text x="50%" y="${labelY + subSize * 1.75}" text-anchor="middle" fill="#a1a1aa" font-family="Segoe UI,system-ui,sans-serif" font-size="${subSize}" font-weight="500">Dijital okul y\u00f6netimi</text>
</svg>`,
  );
  await sharp(brandFrame(w, h))
    .composite([
      { input: await sharp(card).png().toBuffer(), top: cardY, left: cardX },
      { input: icon, top: iconY, left: iconX },
      { input: await sharp(labels).png().toBuffer(), top: 0, left: 0 },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function splash(w, h, out) {
  await promoShot(w, h, out);
}

copyFileSync(sealLogo, join(pwaDir, 'uzaedu-app-icon.png'));
await iconPng(192, join(publicDir, 'icon-192.png'));
await iconPng(512, join(publicDir, 'icon-512.png'));
await maskable(512, join(pwaDir, 'icon-maskable-512.png'));
await promoShot(720, 1280, join(pwaDir, 'screenshot-narrow.png'));
await promoShot(1280, 720, join(pwaDir, 'screenshot-wide.png'));
await splash(1290, 2796, join(pwaDir, 'splash-iphone-15-pro-max.png'));
await splash(1170, 2532, join(pwaDir, 'splash-iphone-14.png'));
await splash(1080, 1920, join(pwaDir, 'splash-android-portrait.png'));
writeFileSync(join(pwaDir, '.generated'), new Date().toISOString());
console.log('PWA brand assets OK (seal center logo)');

