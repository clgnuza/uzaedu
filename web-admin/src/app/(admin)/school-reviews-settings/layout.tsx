import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Okul Değerlendirme Ayarları',
  description: 'Okul değerlendirme modülü, kriterler ve moderasyon',
};

export default function SchoolReviewsSettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
