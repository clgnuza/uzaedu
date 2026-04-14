import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Okul Yönetici Girişi',
  description: 'Okul yönetici hesabınıza giriş yapın. ÖğretmenPro dijital okul platformu.',
  alternates: { canonical: '/login/okul' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
