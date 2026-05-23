import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Haftalık ders programı',
  description: 'Okul tarafından paylaşılan sınıf haftalık ders programı',
  robots: { index: false, follow: false },
};

export default function PaylasimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
