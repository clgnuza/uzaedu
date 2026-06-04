import type { Metadata } from 'next';
import Link from 'next/link';
import { PwaInstallLanding } from '@/components/landing/pwa-install-landing';
import { LandingLoginLink } from '@/components/landing/landing-login-link';

export const metadata: Metadata = {
  title: 'Uygulamayı yükle',
  description:
    'Uzaedu Öğretmen PWA — iPhone Safari, Android Chrome ve masaüstü için ana ekrana ekleme rehberi.',
  alternates: { canonical: '/uygulama' },
};

export default function UygulamaYuklePage() {
  return (
    <div className="landing-page relative flex min-h-dvh flex-col overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(13,148,136,0.22),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_80%,rgba(153,27,27,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_0%_60%,rgba(0,0,0,0.5),transparent)]" />
      </div>

      <header className="relative z-20 flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
        <Link
          href="/"
          className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-600 transition hover:text-zinc-400"
        >
          Uzaedu Öğretmen
        </Link>
        <LandingLoginLink />
      </header>

      <main className="relative z-10 flex-1">
        <PwaInstallLanding variant="page" />
      </main>

      <footer className="relative z-10 shrink-0 px-4 py-6 text-center sm:px-8">
        <p className="text-[10px] text-zinc-600">
          © Uzaedu ·{' '}
          <Link href="/gizlilik" className="underline-offset-2 hover:text-zinc-400 hover:underline">
            Gizlilik
          </Link>
        </p>
      </footer>
    </div>
  );
}
