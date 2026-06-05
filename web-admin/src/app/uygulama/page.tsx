import type { Metadata } from 'next';
import Link from 'next/link';
import { OptikApkDownloadSection } from '@/components/landing/optik-apk-download-section';
import { PwaInstallLanding } from '@/components/landing/pwa-install-landing';
import { LandingLoginLink } from '@/components/landing/landing-login-link';
import { fetchMobileConfigPublic } from '@/lib/mobile-config-public';

export const metadata: Metadata = {
  title: 'Uygulamayı yükle',
  description:
    'Uzaedu Öğretmen PWA — iPhone Safari, Android Chrome ve masaüstü için ana ekrana ekleme rehberi.',
  alternates: { canonical: '/uygulama' },
};

export default async function UygulamaYuklePage() {
  const mobile = await fetchMobileConfigPublic();

  return (
    <div className="landing-page relative flex min-h-dvh flex-col overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-8%,rgba(185,28,28,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_100%_85%,rgba(127,29,29,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_50%_at_0%_55%,rgba(0,0,0,0.55),transparent)]" />
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
        <div className="relative z-10 mx-auto max-w-2xl px-4 pb-8 sm:px-6">
          <OptikApkDownloadSection mobile={mobile} className="mt-6" />
        </div>
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
