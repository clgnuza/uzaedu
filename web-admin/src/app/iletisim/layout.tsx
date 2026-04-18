import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'İletişim',
  description:
    'Uzaedu Öğretmen ile iletişime geçin. Sorularınız, önerileriniz ve destek talepleriniz için bize yazın. uzaeduapp@gmail.com',
  keywords: ['iletişim', 'destek', 'Uzaedu Öğretmen', 'UzaMobil', 'yardım'],
  alternates: { canonical: '/iletisim' },
  openGraph: {
    title: 'İletişim | Uzaedu Öğretmen',
    description: 'Uzaedu Öğretmen destek ve iletişim sayfası.',
  },
};

export default function IletisimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
