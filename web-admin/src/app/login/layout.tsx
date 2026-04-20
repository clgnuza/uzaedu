import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginSessionRedirect } from '@/components/auth/login-session-redirect';

export const metadata: Metadata = {
  title: 'Giriş Yap',
  description: 'Uzaedu Öğretmen hesabınıza giriş yapın. Öğretmen ve okul yöneticisi girişi.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/login' },
};
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <LoginSessionRedirect />
      </Suspense>
      {children}
    </>
  );
}
