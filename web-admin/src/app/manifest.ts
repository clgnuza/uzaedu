import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Uzaedu Öğretmen',
    short_name: 'Öğretmen',
    description: 'Okul yönetimi, akıllı tahta, ders programı',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0d9488',
    lang: 'tr',
    orientation: 'any',
    icons: [
      { src: '/brand/og-default.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: 'Akıllı Tahta',
        short_name: 'Tahta',
        url: '/akilli-tahta',
        description: 'Tahta QR onayı ve bağlantı',
      },
      {
        name: 'Sınav oturumları',
        short_name: 'Sınav',
        url: '/optik-oturumlar',
        description: 'Oturum → anahtar → tara → sonuç',
      },
      {
        name: 'Serbest tarama',
        short_name: 'Tara',
        url: '/optik-okuma',
        description: 'Oturumsuz tek kağıt',
      },
    ],
  };
}
