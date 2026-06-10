import type { MetadataRoute } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import {
  PWA_ICON_192,
  PWA_ICON_512,
  PWA_MASKABLE_ICON,
  PWA_SCREENSHOTS,
  PWA_SEAL_CENTER_LOGO,
  UZAEDU_APP_ICON_PNG,
} from '@/lib/pwa-assets';
import { PWA_FILE_HANDLERS, PWA_LAUNCH_HANDLER, PWA_SHARE_TARGET } from '@/lib/pwa-manifest-extras';

const ICONS: MetadataRoute.Manifest['icons'] = [
  { src: UZAEDU_APP_ICON_PNG, sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: PWA_ICON_192, sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: PWA_ICON_512, sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: PWA_SEAL_CENTER_LOGO, sizes: '1024x1024', type: 'image/png', purpose: 'any' },
  { src: PWA_MASKABLE_ICON, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

function pwaDisplayNames(raw: string | null | undefined) {
  const base = raw?.trim() || 'Uzaedu Öğretmen';
  const name = /^Uzaedu\s/i.test(base) ? base.replace(/\s+Pro$/i, '') : `Uzaedu ${base.replace(/\s+Pro$/i, '')}`;
  return { name, short_name: 'Öğretmen' };
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const extras = await fetchWebExtrasPublic();
  const { name, short_name } = pwaDisplayNames(extras?.pwa_short_name);
  const theme = extras?.theme_color?.trim() || '#991b1b';
  const description = 'Uzaedu Öğretmen';

  return {
    id: '/',
    name,
    short_name,
    description,
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone', 'minimal-ui', 'browser'],
    prefer_related_applications: false,
    background_color: '#050505',
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
