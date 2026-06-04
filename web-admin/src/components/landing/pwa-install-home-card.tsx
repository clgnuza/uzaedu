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
      className="group relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-teal-500/30 bg-linear-to-br from-teal-950/55 via-zinc-950/95 to-zinc-950 p-4 shadow-xl shadow-teal-950/25 transition hover:border-teal-400/45 hover:shadow-teal-900/35 sm:max-w-lg sm:flex-row sm:items-center sm:gap-4 sm:p-5"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-teal-500/15 blur-2xl transition group-hover:bg-teal-400/20"
        aria-hidden
      />
      <div className="relative flex shrink-0 items-center justify-center sm:pl-0.5">
        <UzaeduAppIcon size={60} className="transition group-hover:scale-[1.03]" />
      </div>
      <div className="relative mt-3 min-w-0 flex-1 sm:mt-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-teal-400/90 sm:text-[10px]">
          Ücretsiz · tarayıcıdan
        </p>
        <p className="mt-0.5 text-base font-bold text-white sm:text-lg">Uygulamayı yükle</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400 sm:text-xs">
          iPhone, Android veya bilgisayar — adım adım kurulum rehberi
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {MINI.map((m) => (
            <span
              key={m.text}
              className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
            >
              <m.icon className="size-3 text-teal-400" aria-hidden />
              {m.text}
            </span>
          ))}
        </div>
      </div>
      <span className="relative mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 text-xs font-semibold text-white transition group-hover:bg-teal-500 sm:mt-0 sm:h-10 sm:w-auto sm:shrink-0 sm:px-4">
        <Download className="size-3.5" aria-hidden />
        Kurulum
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
