import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Okul Değerlendirmeleri | Öğretmen Pro',
  description:
    'Türkiye genelinde okulların öğretmenler tarafından yapılan değerlendirmelerini inceleyin. Okul deneyimlerini paylaşın, sorular sorun.',
  openGraph: {
    title: 'Okul Değerlendirmeleri | Öğretmen Pro',
    description:
      'Türkiye genelinde okulların öğretmenler tarafından yapılan değerlendirmelerini inceleyin.',
    type: 'website',
  },
};

export default function OkulDegerlendirmeleriLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
