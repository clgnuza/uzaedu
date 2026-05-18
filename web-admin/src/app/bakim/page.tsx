import type { Metadata } from 'next';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';

export const metadata: Metadata = {
  title: 'Bakım | Uzaedu Öğretmen',
  description: 'Sistem bakımı veya güncelleme. Kısa süre içinde tekrar deneyin.',
  robots: { index: false, follow: false },
};

const DEFAULT_HTML =
  '<p>Bakım veya güncelleme çalışması yapılıyor. Lütfen bir süre sonra tekrar deneyin.</p>';

export default async function BakimPage() {
  const extras = await fetchWebExtrasPublic();
  const html = extras?.maintenance_message_html?.trim() || DEFAULT_HTML;

  return (
    <div className="landing-page relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_42%,rgba(153,27,27,0.24),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_90%_at_0%_50%,rgba(0,0,0,0.55),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_90%_at_100%_50%,rgba(0,0,0,0.55),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_28%_at_50%_0%,rgba(0,0,0,0.5),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.32] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <header
        className="relative z-20 flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4 lg:px-10"
        style={{ animation: 'landing-fadein 0.45s ease both' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-600">Uzaedu Öğretmen</p>
        <Link
          href="/"
          className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-300 sm:text-sm"
        >
          Ana sayfa
        </Link>
      </header>

      <main
        className="relative z-10 mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-6"
        style={{ animation: 'landing-fadein 0.65s ease 0.08s both' }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800/90 bg-zinc-950/75 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-3xl sm:p-10">
          <div className="mb-6 flex justify-center sm:mb-8">
            <div
              className="relative rounded-2xl border border-red-900/35 bg-red-950/30 p-4 sm:p-5"
              aria-hidden
            >
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_30%,rgba(248,113,113,0.12),transparent_65%)]" />
              <RefreshCw
                className="bakim-refresh-icon relative size-9 text-red-400/95 sm:size-11"
                strokeWidth={1.75}
              />
            </div>
          </div>

          <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Geçici olarak kullanılamıyor
          </p>
          <h1 className="mt-2 text-center text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
            Bakım ve güncelleme
          </h1>
          <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-zinc-400">
            Platform güvenli şekilde iyileştiriliyor. Birkaç dakika içinde tekrar deneyebilirsiniz.
          </p>

          <div
            className="bakim-message mt-8 border-t border-zinc-800/80 pt-8 text-left text-[15px] leading-relaxed text-zinc-300 [&_a]:font-medium [&_a]:text-red-400 [&_a]:underline-offset-4 hover:[&_a]:text-red-300 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_li]:marker:text-red-600/80 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-zinc-100 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 shadow-lg shadow-black/20 transition hover:border-zinc-700 hover:bg-zinc-900/80 hover:text-white"
          style={{ animation: 'landing-fadein 0.6s ease 0.2s both' }}
        >
          Ana sayfaya dön
        </Link>
      </main>

      <footer
        className="relative z-10 mt-auto flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-5 text-[10px] text-zinc-700 sm:py-6 sm:text-[10.5px]"
        style={{ animation: 'landing-fadein 0.55s ease 0.22s both' }}
      >
        <Link href="/gizlilik" className="transition hover:text-zinc-400">
          Gizlilik
        </Link>
        <Link href="/iletisim" className="transition hover:text-zinc-400">
          İletişim
        </Link>
      </footer>
    </div>
  );
}
