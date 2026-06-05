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
      className="group relative flex w-full max-w-[min(100%,20rem)] items-center gap-2.5 overflow-hidden rounded-2xl border border-red-800/35 bg-linear-to-br from-red-950/40 via-zinc-950/95 to-zinc-950 px-3 py-2.5 shadow-lg shadow-red-950/25 transition hover:border-red-600/45 sm:max-w-md sm:gap-3 sm:px-4 sm:py-3 md:max-w-lg"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-red-600/15 blur-2xl transition group-hover:bg-red-500/20 sm:size-32"
        aria-hidden
      />
      <UzaeduAppIcon
        size={48}
        className="relative !size-10 shrink-0 transition group-hover:scale-[1.02] sm:!size-11 md:!size-12"
      />
      <div className="relative min-w-0 flex-1 text-left">
        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-red-400/90 sm:text-[9px]">
          Ücretsiz · tarayıcıdan
        </p>
        <p className="text-sm font-bold leading-tight text-white sm:text-base">Uygulamayı yükle</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400 sm:line-clamp-none sm:text-xs">
          iPhone, Android veya bilgisayar — adım adım kurulum
        </p>
        <div className="mt-1.5 hidden flex-wrap gap-1.5 sm:flex">
          {MINI.map((m) => (
            <span
              key={m.text}
              className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
            >
              <m.icon className="size-3 text-red-400" aria-hidden />
              {m.text}
            </span>
          ))}
        </div>
      </div>
      <span className="relative inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl bg-linear-to-r from-red-700 to-red-800 px-3 text-xs font-semibold text-white transition group-hover:from-red-600 group-hover:to-red-700 sm:h-9 sm:px-3.5">
        <Download className="size-3.5" aria-hidden />
        <span className="sm:hidden">Kur</span>
        <span className="hidden sm:inline">Kurulum</span>
        <ArrowRight className="hidden size-3.5 transition group-hover:translate-x-0.5 sm:block" aria-hidden />
      </span>
    </Link>
  );
}
