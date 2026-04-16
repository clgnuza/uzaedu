'use client';

import Link from 'next/link';
import { BarChart3, ChevronLeft, List, Sparkles, Table, Target, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EvalBlobMascot, EvalHeroBackdrop, EvalSparkleCluster } from './eval-decor';

type EvalTab = 'tablo' | 'kriterler' | 'listeler' | 'ozet' | 'araclar';

export function DegerlendirmeHero({
  criteriaCount,
  studentCount,
  weekActivityCount,
  listLabel,
  activeTab,
  onSelectTab,
}: {
  criteriaCount: number;
  studentCount: number;
  weekActivityCount: number;
  listLabel: string;
  activeTab: EvalTab;
  onSelectTab: (tab: EvalTab) => void;
}) {
  const cK = criteriaCount > 99 ? '99+' : String(criteriaCount);
  const cS = studentCount > 99 ? '99+' : String(studentCount);
  const cW = weekActivityCount > 99 ? '99+' : String(weekActivityCount);

  return (
    <Card className="relative mb-2 overflow-hidden rounded-3xl border-indigo-200/55 bg-linear-to-br from-indigo-500/12 via-fuchsia-500/5 to-emerald-500/10 shadow-md ring-1 ring-indigo-500/15 dark:border-indigo-900/50 dark:from-indigo-500/10 dark:via-violet-950/20 dark:to-emerald-950/15 sm:mb-5">
      <EvalHeroBackdrop />
      <CardContent className="relative z-10 flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
        <Link
          href="/ogretmen-ajandasi"
          className="inline-flex w-max items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          <ChevronLeft className="size-3.5 shrink-0" />
          Öğretmen ajandası
        </Link>
        <div className="flex gap-2 sm:gap-3 sm:items-center">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-inner ring-2 ring-indigo-200/60 dark:bg-indigo-950/40 dark:ring-indigo-700/50 sm:size-[4.5rem] sm:rounded-3xl">
            <EvalBlobMascot size={44} className="drop-shadow-sm sm:h-[52px] sm:w-[52px]" />
            <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full bg-amber-400/95 shadow-md ring-2 ring-white dark:ring-indigo-950">
              <EvalSparkleCluster className="size-4 text-amber-950/90" />
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
            <h1 className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold tracking-tight text-indigo-950 dark:text-indigo-50 sm:text-lg">
              <Sparkles className="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
              Öğrenci değerlendirme
            </h1>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              <span className="max-sm:hidden">
                Tablo / ızgara, haftalık özet ve sınıf araçları. Kriter ve listeler sekmelerinden düzenleyin.
              </span>
              <span className="sm:hidden">Sekme: tablo, özet, araç…</span>
            </p>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/55 bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-900 shadow-sm dark:border-violet-700/50 dark:bg-violet-950/35 dark:text-violet-100">
                <Target className="size-3.5 opacity-80" aria-hidden />
                {criteriaCount} kriter
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/55 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-900 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/35 dark:text-emerald-100">
                <Sparkles className="size-3.5 opacity-80" aria-hidden />
                {studentCount} öğrenci
              </span>
              <span className="inline-flex max-w-xs items-center gap-1 truncate rounded-full border border-amber-300/55 bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
                <List className="size-3.5 shrink-0 opacity-80" aria-hidden />
                {listLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto border-t border-border/50 pt-2 pb-0.5 dark:border-border/60 sm:hidden">
          <button
            type="button"
            onClick={() => onSelectTab('tablo')}
            className={cn(
              'flex min-h-9 min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors',
              activeTab === 'tablo'
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-900 dark:text-indigo-100'
                : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            <Table className="size-3 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="tabular-nums font-bold">{cS}</span>
            <span className="text-[9px] font-normal opacity-90">tablo</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('kriterler')}
            className={cn(
              'flex min-h-9 min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors',
              activeTab === 'kriterler'
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
                : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            <Target className="size-3 shrink-0 text-violet-600 dark:text-violet-400" />
            <span className="tabular-nums font-bold">{cK}</span>
            <span className="text-[9px] font-normal opacity-90">kriter</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('listeler')}
            className={cn(
              'flex min-h-9 min-w-[4.25rem] max-w-[5.5rem] shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors',
              activeTab === 'listeler'
                ? 'border-amber-500/40 bg-amber-500/12 text-amber-950 dark:text-amber-100'
                : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
            title={listLabel}
          >
            <List className="size-3 shrink-0 text-amber-700 dark:text-amber-400" />
            <span className="max-w-full truncate px-0.5 text-center text-[9px] font-normal leading-tight opacity-90">
              {listLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('ozet')}
            className={cn(
              'flex min-h-9 min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors',
              activeTab === 'ozet'
                ? 'border-teal-500/40 bg-teal-500/15 text-teal-900 dark:text-teal-100'
                : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            <BarChart3 className="size-3 shrink-0 text-teal-600 dark:text-teal-400" />
            <span className="tabular-nums font-bold">{cW}</span>
            <span className="text-[9px] font-normal opacity-90">özet</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('araclar')}
            className={cn(
              'flex min-h-9 min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors',
              activeTab === 'araclar'
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-900 dark:text-sky-100'
                : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            <Wrench className="size-3 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="tabular-nums font-bold">{cS}</span>
            <span className="text-[9px] font-normal opacity-90">araç</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
