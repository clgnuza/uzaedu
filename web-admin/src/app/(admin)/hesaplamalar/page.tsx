'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Calculator, ClipboardList, Layers, Settings, Sparkles, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type HubTile = {
  href: string;
  title: string;
  description: string;
  icon: typeof Calculator;
  /** dış çerçeve / glow */
  ring: string;
  /** ikon alanı */
  iconShell: string;
  /** kart iç gradient */
  cardBg: string;
  /** vurgu çizgisi (üst) */
  bar: string;
};

const BASE_TILES: HubTile[] = [
  {
    href: '/ek-ders-hesaplama',
    title: 'Ek ders hesaplama',
    description: 'Saat ve dilimlere göre brüt / net tahmini.',
    icon: Calculator,
    ring: 'shadow-[0_0_0_1px_rgba(56,189,248,0.25)] hover:shadow-[0_20px_50px_-12px_rgba(14,165,233,0.35)] dark:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]',
    iconShell:
      'bg-linear-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 dark:from-sky-500 dark:to-blue-700',
    cardBg:
      'bg-linear-to-br from-white/95 via-sky-50/90 to-blue-50/80 dark:from-zinc-900/95 dark:via-sky-950/40 dark:to-zinc-950/90',
    bar: 'from-sky-400 via-cyan-400 to-blue-500',
  },
  {
    href: '/sinav-gorev-ucretleri',
    title: 'Sınav görev ücretleri',
    description: 'ÖSYM, AÖF, AUZEF vb. görev ücreti ve GV / DV.',
    icon: ClipboardList,
    ring: 'shadow-[0_0_0_1px_rgba(167,139,250,0.3)] hover:shadow-[0_20px_50px_-12px_rgba(139,92,246,0.4)] dark:shadow-[0_0_0_1px_rgba(167,139,250,0.22)]',
    iconShell:
      'bg-linear-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/35 dark:from-violet-600 dark:to-fuchsia-700',
    cardBg:
      'bg-linear-to-br from-white/95 via-violet-50/85 to-fuchsia-50/75 dark:from-zinc-900/95 dark:via-violet-950/45 dark:to-zinc-950/90',
    bar: 'from-violet-500 via-fuchsia-500 to-amber-400',
  },
];

const ADMIN_TILES: HubTile[] = [
  {
    href: '/extra-lesson-params',
    title: 'Hesaplama türleri',
    description: 'Parametre hub ve sınav görev kataloğu bağlantıları.',
    icon: Layers,
    ring: 'shadow-[0_0_0_1px_rgba(34,211,238,0.28)] hover:shadow-[0_20px_50px_-12px_rgba(6,182,212,0.35)]',
    iconShell:
      'bg-linear-to-br from-cyan-400 to-teal-600 text-white shadow-lg shadow-cyan-500/30 dark:from-cyan-500 dark:to-teal-700',
    cardBg:
      'bg-linear-to-br from-white/95 via-cyan-50/80 to-teal-50/70 dark:from-zinc-900/95 dark:via-cyan-950/35 dark:to-zinc-950/90',
    bar: 'from-cyan-400 via-teal-400 to-emerald-500',
  },
  {
    href: '/extra-lesson-params/ek-ders',
    title: 'Ek ders parametreleri',
    description: 'Bütçe, gösterge, birim ücret ve vergi dilimleri.',
    icon: Settings,
    ring: 'shadow-[0_0_0_1px_rgba(52,211,153,0.28)] hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.35)]',
    iconShell:
      'bg-linear-to-br from-emerald-400 to-teal-700 text-white shadow-lg shadow-emerald-500/30 dark:from-emerald-500 dark:to-teal-800',
    cardBg:
      'bg-linear-to-br from-white/95 via-emerald-50/80 to-teal-50/70 dark:from-zinc-900/95 dark:via-emerald-950/35 dark:to-zinc-950/90',
    bar: 'from-emerald-400 via-teal-500 to-cyan-500',
  },
];

function MeshBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] animate-pulse rounded-full bg-linear-to-br from-sky-400/25 via-violet-400/20 to-fuchsia-400/15 blur-3xl [animation-duration:12s] motion-reduce:animate-none dark:from-sky-600/20 dark:via-violet-600/15 dark:to-fuchsia-600/10" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[60%] w-[60%] rounded-full bg-linear-to-tl from-amber-400/15 via-rose-400/10 to-transparent blur-3xl dark:from-amber-600/12" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.55 0.02 265 / 0.15) 1px, transparent 0)`,
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  );
}

export default function HesaplamalarHubPage() {
  const { me } = useAuth();
  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canAdminParams = useMemo(
    () =>
      me?.role === 'superadmin' ||
      (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('extra_lesson_params')),
    [me?.role, mods],
  );

  const tiles = useMemo(() => {
    if (!canAdminParams) return BASE_TILES;
    return [...BASE_TILES, ...ADMIN_TILES];
  }, [canAdminParams]);

  return (
    <div className="relative -mx-4 -mt-2 min-h-0 overflow-hidden rounded-none border-x-0 border-t-0 border-b border-border/40 bg-linear-to-b from-slate-50/90 via-white to-violet-50/30 px-3 pb-6 pt-0 sm:-mx-6 sm:pb-10 sm:pt-0 lg:mx-0 lg:max-w-none lg:rounded-2xl lg:border lg:border-border/30 lg:bg-linear-to-br lg:from-slate-50/80 lg:via-white lg:to-cyan-50/20 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/30 lg:dark:from-zinc-950 lg:dark:via-zinc-950 lg:dark:to-violet-950/40">
        <MeshBackdrop />

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Hero */}
          <header className="mb-3 pt-0 text-center sm:mb-7 sm:pt-2">
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-700 shadow-sm backdrop-blur-md dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-200 sm:mb-2.5 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.16em]">
              <Sparkles className="size-2.5 text-amber-500 sm:size-3" aria-hidden />
              Ücretsiz araçlar
            </div>
            <h1 className="mx-auto max-w-2xl bg-linear-to-r from-zinc-900 via-violet-700 to-cyan-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-4xl sm:font-black md:text-[2.75rem] dark:from-white dark:via-violet-300 dark:to-cyan-300">
              Hesaplamalar
            </h1>
            <p className="mx-auto mt-1.5 max-w-lg px-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-2.5 sm:text-[15px] sm:leading-relaxed">
              Ek ders ve sınav görev ücreti hesaplarına buradan geçin. İleride eklenecek hesaplar da bu sayfada
              listelenir.
            </p>
          </header>

          {/* Tiles */}
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
            {tiles.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-2xl border-2 border-white/90 p-px shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)] transition-all duration-300 dark:border-zinc-700/80 dark:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)]',
                    'hover:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgba(99,102,241,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    item.ring,
                  )}
                >
                  {/* üst renk şeridi */}
                  <div
                    className={cn(
                      'h-1 w-full bg-linear-to-r opacity-95 transition-opacity group-hover:opacity-100 sm:h-1.5',
                      item.bar,
                    )}
                  />
                  <div
                    className={cn(
                      'flex min-h-[112px] flex-1 flex-col rounded-[calc(1rem-2px)] p-3.5 sm:min-h-[140px] sm:rounded-[calc(1.25rem-2px)] sm:p-5',
                      item.cardBg,
                    )}
                  >
                    <div className="flex gap-2.5 sm:gap-4">
                      <div
                        className={cn(
                          'mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl shadow-lg ring-2 ring-white/50 sm:mt-1 sm:size-12 sm:rounded-2xl dark:ring-zinc-900/50',
                          item.iconShell,
                        )}
                      >
                        <Icon className="size-5 sm:size-6" strokeWidth={1.75} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-left text-sm font-bold leading-tight tracking-tight text-foreground sm:text-lg sm:leading-snug">
                            {item.title}
                          </h2>
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/15 bg-white/90 text-primary shadow-sm backdrop-blur-sm transition-all group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-200 dark:group-hover:text-primary-foreground sm:size-9">
                            <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:size-3.5" />
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:text-sm sm:leading-relaxed">
                          {item.description}
                        </p>
                        <div className="mt-2.5 flex items-center sm:mt-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900/5 px-2 py-1 text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary dark:bg-white/5 dark:ring-primary/25 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                            Sayfaya git
                            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                              →
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="relative z-10 mt-4 px-1 text-center text-[10px] leading-snug text-muted-foreground/90 sm:mt-6 sm:text-[11px]">
            Tahminler bilgilendirme amaçlıdır; resmi tebliğ ve kurum uygulamasına göre değişebilir.
          </p>
        </div>
      </div>
  );
}
