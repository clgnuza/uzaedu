import type { GuestPublicWebShellNav } from '@/lib/web-extras-public';

/** Backend `web-extras.defaults` ile aynı — Uzaedu Öğretmen misafir sayfaları. */
export const OGRETMEN_PRO_GUEST_SHELL_NAV: GuestPublicWebShellNav = {
  top_bar_enabled: true,
  top_bar_items: [
    { label: 'Haberler', href: '/haberler', icon_key: 'newspaper' },
    { label: 'Hesaplamalar', href: '/hesaplamalar', icon_key: 'calculator' },
    { label: 'Okul değerlendirmeleri', href: '/okul-degerlendirmeleri', icon_key: 'star' },
    { label: 'Ek ders hesabı', href: '/ek-ders-hesaplama', icon_key: 'book-open' },
    { label: 'Sınav görev ücretleri', href: '/sinav-gorev-ucretleri', icon_key: 'graduation-cap' },
  ],
  bottom_bar_enabled: true,
  bottom_bar_items: [
    { label: 'Haberler', href: '/haberler', icon_key: 'newspaper' },
    { label: 'Hesaplamalar', href: '/hesaplamalar', icon_key: 'calculator' },
    { label: 'Okul değerl.', href: '/okul-degerlendirmeleri', icon_key: 'star' },
    { label: 'Ek ders', href: '/ek-ders-hesaplama', icon_key: 'book-open' },
    { label: 'Sınav görev', href: '/sinav-gorev-ucretleri', icon_key: 'graduation-cap' },
  ],
  bottom_bar_mobile_only: true,
};
