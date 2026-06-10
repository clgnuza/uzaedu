/**
 * Kanal bildirim ikonları (PNG) + badge + geniş banner — Android Web Push
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'push-icons');
const bannersDir = join(iconsDir, 'banners');
const sealLogo = join(root, 'public', 'landing', 'uza-logo.png');
mkdirSync(bannersDir, { recursive: true });

const CHANNEL_LABELS = {
  nobet: 'Nöbet',
  ders_programi: 'Ders programı',
  akilli_tahta: 'Akıllı tahta',
  sinav_gorevi: 'Sınav görevi',
  sinav_modulleri: 'Sınav modülleri',
  destek: 'Destek',
  ajanda: 'Ajanda',
  bilsem: 'Bilsem',
  belirli_gun: 'Belirli gün / hafta',
  mesaj_merkezi: 'Mesaj merkezi',
  market: 'Market',
  yolluk: 'Yolluk',
  okul_degerlendirme: 'Değerlendirme',
  duyuru: 'Duyuru',
  genel: 'Genel',
};

const CHANNEL_ACCENT = {
  nobet: ['#4f46e5', '#7c3aed'],
  ders_programi: ['#10b981', '#0d9488'],
  akilli_tahta: ['#06b6d4', '#0284c7'],
  sinav_gorevi: ['#0ea5e9', '#2563eb'],
  sinav_modulleri: ['#f59e0b', '#ea580c'],
  destek: ['#d946ef', '#9333ea'],
  ajanda: ['#f43f5e', '#db2777'],
  bilsem: ['#8b5cf6', '#7c3aed'],
  belirli_gun: ['#f59e0b', '#f97316'],
  mesaj_merkezi: ['#22c55e', '#16a34a'],
  market: ['#84cc16', '#65a30d'],
  yolluk: ['#14b8a6', '#059669'],
  okul_degerlendirme: ['#e11d48', '#b91c1c'],
  duyuru: ['#eab308', '#ca8a04'],
  genel: ['#64748b', '#475569'],
};

async function svgToPng(svgPath, outPath, size) {
  await sharp(svgPath).resize(size, size).png().toFile(outPath);
}

async function makeBadge() {
  const size = 96;
  const logo = await sharp(sealLogo)
    .resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const pad = Math.round((size - Math.round(size * 0.72)) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .greyscale()
    .toFile(join(iconsDir, 'badge.png'));
  console.log('wrote badge.png');
}

async function makeBanner(id, label, colors) {
  const w = 1024;
  const h = 512;
  const iconPath = join(iconsDir, `${id}.png`);
  const iconBuf = await sharp(iconPath).resize(160, 160).png().toBuffer();
  const [c1, c2] = colors;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="${h}" fill="url(#a)"/>
  <rect x="48" y="48" width="200" height="200" rx="48" fill="url(#a)" opacity="0.18"/>
  <text x="280" y="210" fill="#fafafa" font-family="Segoe UI,system-ui,sans-serif" font-size="52" font-weight="700">${label}</text>
  <text x="280" y="270" fill="#a1a1aa" font-family="Segoe UI,system-ui,sans-serif" font-size="28" font-weight="500">Uzaedu Öğretmen</text>
  <text x="280" y="330" fill="#71717a" font-family="Segoe UI,system-ui,sans-serif" font-size="22">Okul yönetimi bildirimi</text>
</svg>`);
  await sharp(bg)
    .composite([{ input: iconBuf, top: 176, left: 72 }])
    .png()
    .toFile(join(bannersDir, `${id}.png`));
  console.log('wrote banner', id);
}

const svgs = readdirSync(iconsDir).filter((f) => f.endsWith('.svg'));
for (const file of svgs) {
  const id = file.replace(/\.svg$/, '');
  const svgPath = join(iconsDir, file);
  await svgToPng(svgPath, join(iconsDir, `${id}.png`), 192);
  console.log('wrote', `${id}.png`);
}

await makeBadge();
for (const [id, label] of Object.entries(CHANNEL_LABELS)) {
  await makeBanner(id, label, CHANNEL_ACCENT[id]);
}
writeFileSync(join(iconsDir, '.generated'), new Date().toISOString());
console.log('Push notification assets OK');
