import type { Metadata } from 'next';

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
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import { LandingLoginLink } from '@/components/landing/landing-login-link';
import { SealHub } from '@/components/landing/seal-hub';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';

const LEGAL = [
  { href: '/gizlilik',        label: 'Gizlilik' },
  { href: '/kullanim-sartlari', label: 'Kullanım şartları' },
  { href: '/cerez',           label: 'Çerez politikası' },
] as const;

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="m17.6 9.48 1.84-3.18c.16-.31.04-.69-.26-.85a.64.64 0 0 0-.86.21l-1.9 3.28A10.51 10.51 0 0 0 12 8c-1.53 0-2.98.32-4.42.94L5.68 5.66a.64.64 0 0 0-.86-.21.63.63 0 0 0-.26.85L6.4 9.48A9.86 9.86 0 0 0 2 17h20a9.86 9.86 0 0 0-4.4-7.52zM8.95 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6.1 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="landing-page relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#050505] text-white">

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
        <nav className="flex items-center gap-2" aria-label="Hesap">
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
      <main
        className="relative z-10 mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-2 pb-4 pt-1 sm:px-4 sm:pb-7 sm:pt-2 md:px-6 lg:px-8"
        style={{ animation: 'landing-fadein 0.7s ease 0.1s both' }}
      >
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0">
          <SealHub />
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

          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <button
              type="button"
              disabled
              aria-label="iOS uygulaması yakında"
              className="group flex min-h-[44px] min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-3 py-2 text-left opacity-90 sm:min-h-[52px] sm:flex-initial sm:justify-start sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-3"
            >
              <AppleIcon className="size-5 shrink-0 text-white sm:size-7" />
              <div className="min-w-0 text-left leading-tight">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[9px] sm:tracking-widest">App Store</p>
                <p className="text-[12px] font-bold text-amber-200/95 sm:text-[13px]">Yakında</p>
              </div>
            </button>

            <button
              type="button"
              disabled
              aria-label="Android uygulaması yakında"
              className="group flex min-h-[44px] min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/70 px-3 py-2 text-left opacity-90 sm:min-h-[52px] sm:flex-initial sm:justify-start sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-3"
            >
              <AndroidIcon className="size-5 shrink-0 text-[#78c257] sm:size-7" />
              <div className="min-w-0 text-left leading-tight">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[9px] sm:tracking-widest">Google Play</p>
                <p className="text-[12px] font-bold text-amber-200/95 sm:text-[13px]">Yakında</p>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-[10px] text-zinc-700 sm:gap-x-5 sm:py-5 sm:text-[10.5px]"
        style={{ animation: 'landing-fadein 0.7s ease 0.35s both' }}
      >
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className="transition hover:text-zinc-400">
            {l.label}
          </Link>
        ))}
        <CookiePreferencesLink className="transition hover:text-zinc-400" />
      </footer>
    </div>
  );
}
