import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Okul Kayıt',
  description: 'Okulunuzu ÖğretmenPro’ya kayıt edin. Tüm öğretmenlerinizi tek platformda yönetin.',
  alternates: { canonical: '/register/okul' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
