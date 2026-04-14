import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Sınav Yerim',
  description: 'Sınav görev yeri sorgulama. ÖğretmenPro sınav görev sistemi.',
  alternates: { canonical: '/sinav-yerim' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
