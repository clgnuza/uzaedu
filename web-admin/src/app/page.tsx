import type { Metadata } from 'next';
import Script from 'next/script';
import { LANDING_MODULES_SEO, landingModulesJsonLd, modulePublicPath } from '@/lib/landing-modules-seo';
import { normalizePublicSiteUrl } from '@/lib/site-url';

export const revalidate = 3600;

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  title: 'Uzaedu Öğretmen | Dijital Okul Yönetim Platformu',
  description:
    'Öğretmenler ve okul yöneticileri için ders programı, sınav planlama, akademik takvim, ek ders hesaplama, öğretmen ajandası. MEB uyumlu yerli ve milli yazılım.',
  keywords: ['öğretmen', 'okul yönetimi', 'ders programı', 'sınav planlama', 'akademik takvim', 'ek ders', 'MEB', 'Uzaedu Öğretmen'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'Uzaedu Öğretmen | Dijital Okul Yönetim Platformu',
    description: 'Öğretmenler ve okul yöneticileri için MEB uyumlu dijital platform.',
    locale: 'tr_TR',
  },
};

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { PwaInstallHomeCard } from '@/components/landing/pwa-install-home-card';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import { LandingLoginLink } from '@/components/landing/landing-login-link';
import { SealHubClient } from '@/components/landing/seal-hub-client';
import { LandingFeaturesSection } from '@/components/landing/landing-features-section';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';

const FOOTER_LINKS = [
  { href: '/gizlilik', label: 'Gizlilik' },
  { href: '/kullanim-sartlari', label: 'Kullanım şartları' },
  { href: '/cerez', label: 'Çerez politikası' },
  { href: '/iletisim', label: 'İletişim' },
] as const;

export default function HomePage() {
  return (
    <div className="landing-page relative flex min-h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-[#050505] text-white">
      <Script
        id="landing-modules-jsonld"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingModulesJsonLd(SITE_URL)),
        }}
      />
      <nav className="sr-only" aria-label="Okul modülleri">
        <ul>
          <li>
            <Link href="/moduller">Tüm modüller</Link>
          </li>
          {LANDING_MODULES_SEO.map((m) => (
            <li key={m.slug}>
              <Link href={modulePublicPath(m)}>{m.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_48%,rgba(153,27,27,0.27),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_35%_80%_at_0%_50%,rgba(0,0,0,0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_35%_80%_at_100%_50%,rgba(0,0,0,0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_22%_at_50%_0%,rgba(0,0,0,0.55),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.36] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ── Header ── */}
      <header
        className="relative z-20 flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4 lg:px-10"
        style={{ animation: 'landing-fadein 0.5s ease both' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-600">Uzaedu Öğretmen</p>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Hesap">
          <a
            href="#ozellikler"
            className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 sm:inline-flex"
          >
            Modüller
          </a>
          <LandingLoginLink />
          <AuthTransitionLink
            href="/register"
            className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-red-700 to-red-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-red-950/50 transition hover:from-red-600 hover:to-red-700 sm:px-4 sm:py-2"
          >
            <UserPlus className="size-3.5" strokeWidth={2} />
            Kayıt
          </AuthTransitionLink>
        </nav>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 mx-auto flex w-full min-w-0 flex-col items-center">
        <section
          className="flex w-full min-h-[min(100dvh,920px)] flex-col items-center justify-center px-2 pb-4 pt-1 sm:min-h-dvh sm:px-4 sm:pb-7 sm:pt-2 md:px-6 lg:px-8"
          style={{ animation: 'landing-fadein 0.7s ease 0.1s both' }}
        >
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0">
          <SealHubClient />
        </div>

        {/* ── Bottom CTA strip ── */}
        <div
          className="mt-4 flex w-full max-w-xl flex-col items-center gap-2.5 sm:mt-10 sm:max-w-2xl sm:gap-5"
          style={{ animation: 'landing-fadein 0.7s ease 0.25s both' }}
        >
          <div className="flex w-full min-w-0 items-center gap-2 px-1 sm:gap-4">
            <div className="h-px flex-1 bg-linear-to-r from-transparent to-zinc-800" />
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600 sm:text-[10px] sm:tracking-[0.25em]">
              Mobil uygulama
            </span>
            <div className="h-px flex-1 bg-linear-to-l from-transparent to-zinc-800" />
          </div>

          <PwaInstallHomeCard />
        </div>
        </section>

        <LandingFeaturesSection />
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 shrink-0 px-4 py-5 sm:px-8 sm:py-6"
        style={{ animation: 'landing-fadein 0.7s ease 0.35s both' }}
      >
        <nav
          className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2"
          aria-label="Alt bağlantılar"
        >
          <Link href="/moduller" className="landing-footer-chip landing-footer-chip--brand">
            Modüller
          </Link>
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="landing-footer-chip">
              {l.label}
            </Link>
          ))}
          <CookiePreferencesLink className="landing-footer-chip" />
        </nav>
      </footer>
    </div>
  );
}
