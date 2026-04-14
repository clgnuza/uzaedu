import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Öğretmen Kayıt',
  description: 'Öğretmen olarak ÖğretmenPro’ya kayıt olun. Ders programı, ajanda ve daha fazlasına erişin.',
  alternates: { canonical: '/register/ogretmen' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
