import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Şifremi Unuttum',
  description: 'ÖğretmenPro şifre sıfırlama. E-posta adresinizle yeni şifre oluşturun.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
