import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Giriş Yap',
  description: 'ÖğretmenPro hesabınıza giriş yapın. Öğretmen ve okul yöneticisi girişi.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/login' },
};
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
