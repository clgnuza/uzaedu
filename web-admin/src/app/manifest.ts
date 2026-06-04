import type { MetadataRoute } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { PWA_MASKABLE_ICON, PWA_SCREENSHOTS } from '@/lib/pwa-assets';
import { PWA_FILE_HANDLERS, PWA_LAUNCH_HANDLER, PWA_SHARE_TARGET } from '@/lib/pwa-manifest-extras';

const ICONS: MetadataRoute.Manifest['icons'] = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: PWA_MASKABLE_ICON, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: '/brand/og-default.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const extras = await fetchWebExtrasPublic();
  const shortName = extras?.pwa_short_name?.trim() || 'Öğretmen';
  const theme = extras?.theme_color?.trim() || '#0d9488';

  return {
    id: '/',
    name: `Uzaedu ${shortName}`,
    short_name: shortName,
    description: 'Okul yönetimi: ders programı, optik, akıllı tahta, nöbet, ek ders ve daha fazlası',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone', 'minimal-ui', 'browser'],
    prefer_related_applications: false,
    background_color: '#0f172a',
    theme_color: theme,
    lang: 'tr',
    orientation: 'any',
    categories: ['education', 'productivity'],
    icons: ICONS,
    screenshots: PWA_SCREENSHOTS.map((s) => ({
      src: s.src,
      sizes: s.sizes,
      type: s.type,
      form_factor: s.form_factor,
      label: 'Uzaedu Öğretmen',
    })),
    share_target: PWA_SHARE_TARGET,
    file_handlers: PWA_FILE_HANDLERS,
    launch_handler: PWA_LAUNCH_HANDLER,
    shortcuts: [
      {
        name: 'Panel',
        short_name: 'Panel',
        url: '/dashboard',
        description: 'Ana kontrol paneli',
      },
      {
        name: 'Akıllı Tahta',
        short_name: 'Tahta',
        url: '/akilli-tahta',
        description: 'Tahta QR ve oturum',
      },
      {
        name: 'Optik okuma',
        short_name: 'Optik',
        url: '/optik-oturumlar',
        description: 'Sınav oturumları ve raporlar (tarama mobil uygulama)',
      },
      {
        name: 'Ders programı',
        short_name: 'Program',
        url: '/ders-dagit',
        description: 'Ders dağıtım ve program',
      },
      {
        name: 'Nöbet',
        short_name: 'Nöbet',
        url: '/duty',
        description: 'Nöbet planı',
      },
      {
        name: 'Ajanda',
        short_name: 'Ajanda',
        url: '/ogretmen-ajandasi',
        description: 'Öğretmen ajandası',
      },
      {
        name: 'Mesaj merkezi',
        short_name: 'Mesaj',
        url: '/mesaj-merkezi',
        description: 'Veli / öğretmen mesajları',
      },
    ],
  };
}
