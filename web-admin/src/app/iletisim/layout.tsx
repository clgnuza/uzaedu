import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'İletişim',
  description:
    'ÖğretmenPro ile iletişime geçin. Sorularınız, önerileriniz ve destek talepleriniz için bize yazın. uzaeduapp@gmail.com',
  keywords: ['iletişim', 'destek', 'ÖğretmenPro', 'UzaMobil', 'yardım'],
  alternates: { canonical: '/iletisim' },
  openGraph: {
    title: 'İletişim | ÖğretmenPro',
    description: 'ÖğretmenPro destek ve iletişim sayfası.',
  },
};

export default function IletisimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
