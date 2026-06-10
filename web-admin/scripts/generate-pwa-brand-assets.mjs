/**
 * PWA ikon + kurulum kartı screenshot (logo kartı only)
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
  <rect width="${w}" height="${h}" fill="#050505"/>
  <radialGradient id="glow" cx="50%" cy="50%" r="42%">
    <stop offset="0%" stop-color="#dc2626" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
  </radialGradient>
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

/** Chrome Install kartı — sadece logo kartı, ortada */
async function installCardShot(w, h, out) {
  const cardW = Math.round(Math.min(w, h) * 0.46);
  const cardH = Math.round(cardW * 1.02);
  const cardX = Math.round((w - cardW) / 2);
  const cardY = Math.round((h - cardH) / 2);
  const iconSize = Math.round(cardW * 0.52);
  const labelSize = Math.round(cardW * 0.058);
  const iconX = cardX + Math.round((cardW - iconSize) / 2);
  const iconY = cardY + Math.round(cardH * 0.16);
  const icon = await logoBuffer(iconSize);

  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="cardShine" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${Math.round(cardW * 0.12)}" fill="#0a0a0a" stroke="rgba(220,38,38,0.38)" stroke-width="2"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${Math.round(cardW * 0.12)}" fill="url(#cardShine)"/>
  <text x="${cardX + cardW / 2}" y="${iconY + iconSize + Math.round(labelSize * 2.1)}" text-anchor="middle" fill="#f87171" font-family="Segoe UI,system-ui,sans-serif" font-size="${labelSize}" font-weight="700" letter-spacing="0.24em">UZAEDU \u00d6\u011eRETMEN</text>
</svg>`);

  await sharp(brandFrame(w, h))
    .composite([
      { input: await sharp(overlay).png().toBuffer(), top: 0, left: 0 },
      { input: icon, top: iconY, left: iconX },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

copyFileSync(sealLogo, join(pwaDir, 'uzaedu-app-icon.png'));
await iconPng(192, join(publicDir, 'icon-192.png'));
await iconPng(512, join(publicDir, 'icon-512.png'));
await maskable(512, join(pwaDir, 'icon-maskable-512.png'));
await installCardShot(720, 1280, join(pwaDir, 'screenshot-narrow.png'));
await installCardShot(1280, 720, join(pwaDir, 'screenshot-wide.png'));
await installCardShot(1290, 2796, join(pwaDir, 'splash-iphone-15-pro-max.png'));
await installCardShot(1170, 2532, join(pwaDir, 'splash-iphone-14.png'));
await installCardShot(1080, 1920, join(pwaDir, 'splash-android-portrait.png'));
writeFileSync(join(pwaDir, '.generated'), new Date().toISOString());
console.log('PWA brand assets OK (install logo card)');
