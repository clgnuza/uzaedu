import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Öğretmen Girişi',
  description: 'Öğretmen hesabınıza giriş yapın. ÖğretmenPro dijital okul platformu.',
  alternates: { canonical: '/login/ogretmen' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
