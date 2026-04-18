'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type BilsemYillikPlanHeroCardProps = {
  onOpenGuide: () => void;
  role: 'teacher' | 'admin';
  className?: string;
}

/** Üst bilgi: SVG + tek kart; uzun madde listesi yerine. */
export function BilsemYillikPlanHeroCard({ onOpenGuide, role, className }: BilsemYillikPlanHeroCardProps) {
  const blurb =
    role === 'teacher'
      ? 'Yıl ve grup → ders → kazanımlar → Word şablonu ve indir. Dosyalar Arşiv’de kalır.'
      : 'Öğretim yılı ve grup seçimleri şablon listesini belirler; kazanımlar ve üretim adımları aynı akıştadır.';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-violet-400/35 bg-gradient-to-br from-violet-500/[0.08] via-background to-fuchsia-500/[0.06] p-2.5 shadow-sm ring-1 ring-violet-500/10 dark:border-violet-500/35 dark:from-violet-950/55 dark:to-fuchsia-950/25 dark:ring-violet-500/15 sm:rounded-2xl sm:p-5',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-fuchsia-400/12 blur-2xl dark:bg-fuchsia-500/15 sm:-right-8 sm:-top-8 sm:h-32 sm:w-32 sm:bg-fuchsia-400/15"
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <svg
            className="h-10 w-10 shrink-0 text-violet-600 drop-shadow-sm dark:text-violet-300 sm:h-[5.25rem] sm:w-[5.25rem]"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <linearGradient id="bilsem-hero-g" x1="12" y1="8" x2="84" y2="88" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <rect x="14" y="18" width="56" height="68" rx="10" fill="url(#bilsem-hero-g)" opacity="0.22" />
            <path
              d="M22 26h40v6H22v-6zm0 12h32v4H22v-4zm0 10h36v4H22v-4zm0 10h28v4H22v-4z"
              fill="currentColor"
              opacity="0.35"
            />
            <path
              d="M48 52c8-2 18 2 22 10l-6 10c-6-8-16-10-24-6l-8-14c4-2 10-2 16 0z"
              fill="currentColor"
              opacity="0.9"
            />
            <circle cx="68" cy="24" r="14" fill="url(#bilsem-hero-g)" opacity="0.85" />
            <path
              d="M64 22l4 4 8-6"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 text-center sm:space-y-2 sm:text-left">
          <div className="flex flex-col items-center gap-0.5 sm:items-start sm:gap-1">
            <span className="inline-flex items-center rounded-full bg-violet-600/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-800 ring-1 ring-violet-500/20 dark:bg-violet-500/20 dark:text-violet-100 sm:px-2.5 sm:text-[10px]">
              Bilsem · Word yıllık plan
            </span>
            <h2 className="text-[13px] font-semibold leading-tight text-foreground sm:text-lg">Hızlı akış</h2>
          </div>
          <p className="text-pretty text-[11px] leading-snug text-muted-foreground max-sm:line-clamp-2 sm:text-sm sm:leading-relaxed sm:line-clamp-none">
            {blurb}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenGuide}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-md border border-violet-500/40 bg-background/95 px-2.5 py-1.5 text-[11px] font-semibold text-violet-900 shadow-sm transition-colors hover:bg-violet-500/10 dark:border-violet-400/35 dark:bg-violet-950/60 dark:text-violet-100 dark:hover:bg-violet-950 sm:w-auto sm:gap-2 sm:self-center sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
          aria-label="Adım adım rehberi aç"
        >
          <HelpCircle className="size-3.5 shrink-0 sm:size-4" />
          <span className="sm:inline">Rehber</span>
          <span className="hidden sm:inline">i aç</span>
        </button>
      </div>
    </div>
  );
}
