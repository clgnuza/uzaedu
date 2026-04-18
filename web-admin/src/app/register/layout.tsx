import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Kayıt Ol',
  description: 'Uzaedu Öğretmen\'e ücretsiz kayıt olun. Öğretmen veya okul yöneticisi olarak başlangıç yapın.',
  alternates: { canonical: '/register' },
};
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
