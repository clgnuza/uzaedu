'use client';

import Link from 'next/link';
import { ArrowRight, BellRing, Download, Smartphone, Zap } from 'lucide-react';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';

const MINI = [
  { icon: Zap, text: 'Tam ekran' },
  { icon: BellRing, text: 'Bildirim' },
  { icon: Smartphone, text: 'Ana ekran' },
] as const;

/** Anasayfa — /uygulama kurulum rehberine giriş */
export function PwaInstallHomeCard() {
  return (
    <Link
      href="/uygulama"
      className="group relative flex w-full max-w-[min(100%,19.5rem)] items-center gap-2 overflow-hidden rounded-xl border border-teal-500/25 bg-linear-to-br from-teal-950/50 via-zinc-950/95 to-zinc-950 px-2.5 py-2 shadow-lg shadow-teal-950/20 transition hover:border-teal-400/40 sm:max-w-md sm:gap-2.5 sm:rounded-2xl sm:px-3.5 sm:py-2.5 md:max-w-lg md:gap-3 md:px-4 md:py-3"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-teal-500/12 blur-xl transition group-hover:bg-teal-400/18 sm:size-28"
        aria-hidden
      />
      <UzaeduAppIcon
        size={48}
        className="relative !size-9 shrink-0 drop-shadow-[0_4px_12px_rgba(13,148,136,0.28)] transition group-hover:scale-[1.02] sm:!size-11 md:!size-[3.25rem]"
      />
      <div className="relative min-w-0 flex-1">
        <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-teal-400/85 sm:text-[8px] sm:tracking-[0.18em] md:text-[9px]">
          Ücretsiz · tarayıcıdan
        </p>
        <p className="text-[13px] font-bold leading-tight text-white sm:text-sm md:text-base">
          Uygulamayı yükle
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-400 sm:line-clamp-none sm:text-[11px] md:text-xs">
          iPhone, Android veya bilgisayar — adım adım kurulum
        </p>
        <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex md:mt-2 md:gap-1.5">
          {MINI.map((m) => (
            <span
              key={m.text}
              className="inline-flex items-center gap-0.5 rounded border border-white/8 bg-white/5 px-1.5 py-px text-[9px] font-medium text-zinc-300 md:gap-1 md:px-2 md:py-0.5 md:text-[10px]"
            >
              <m.icon className="size-2.5 text-teal-400 md:size-3" aria-hidden />
              {m.text}
            </span>
          ))}
        </div>
      </div>
      <span className="relative inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg bg-teal-600 px-2 text-[10px] font-semibold text-white transition group-hover:bg-teal-500 sm:h-8 sm:px-2.5 sm:text-xs md:px-3">
        <Download className="size-3 sm:size-3.5" aria-hidden />
        <span className="sm:hidden">Kur</span>
        <span className="hidden sm:inline">Kurulum</span>
        <ArrowRight className="hidden size-3 transition group-hover:translate-x-0.5 sm:block sm:size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
