'use client';

import Link from 'next/link';
import { ChevronLeft, List, Table, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EvalTab = 'tablo' | 'kriterler' | 'listeler';

function DegerlendirmeIcon({ className, size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="24" cy="24" r="18" className="fill-indigo-500/20 dark:fill-indigo-400/15" />
      <path
        d="M16 28c3-6 8-9 16-10M20 20h12M20 24h10M20 28h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="text-indigo-700/80 dark:text-indigo-300/90"
      />
      <circle cx="32" cy="14" r="5" className="fill-amber-400/90 dark:fill-amber-500/85" />
      <path d="M30 14l1.5 1.5L35 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DegerlendirmeHero({
  criteriaCount,
  studentCount,
  listLabel,
  activeTab,
  onSelectTab,
}: {
  criteriaCount: number;
  studentCount: number;
  listLabel: string;
  activeTab: EvalTab;
  onSelectTab: (tab: EvalTab) => void;
}) {
  const cK = criteriaCount > 99 ? '99+' : String(criteriaCount);
  const cS = studentCount > 99 ? '99+' : String(studentCount);

  return (
    <Card className="mb-2 overflow-hidden border-indigo-200/50 bg-linear-to-br from-indigo-500/8 via-background to-violet-500/6 shadow-sm ring-1 ring-indigo-500/10 dark:border-indigo-900/45 sm:mb-5">
      <CardContent className="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
        <Link
          href="/ogretmen-ajandasi"
          className="inline-flex w-max items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          <ChevronLeft className="size-3.5 shrink-0" />
          Öğretmen ajandası
        </Link>
        <div className="flex gap-2 sm:gap-3 sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 sm:size-16 sm:rounded-2xl">
            <DegerlendirmeIcon size={40} className="text-indigo-700 dark:text-indigo-300 sm:h-12 sm:w-12" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
            <h1 className="text-sm font-bold tracking-tight sm:text-lg">Öğrenci değerlendirme</h1>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              <span className="max-sm:hidden">Tabloda puan ve hızlı +/- not; Kriterler ve Listeler sekmelerinden düzenleyin.</span>
              <span className="sm:hidden">Aşağıdan sekme seçin; öğrenci kartlarında puanlayın.</span>
            </p>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <span className="inline-flex items-center rounded-full border border-violet-300/50 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-900 dark:border-violet-800 dark:text-violet-100">
                {criteriaCount} kriter
              </span>
              <span className="inline-flex items-center rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:text-emerald-100">
                {studentCount} öğrenci
              </span>
              <span className="inline-flex max-w-xs items-center truncate rounded-full border border-amber-300/50 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:text-amber-100">
                {listLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid max-sm:grid-cols-3 gap-1 border-t border-border/50 pt-2 dark:border-border/60 sm:hidden">
          <button
            type="button"
            onClick={() => onSelectTab('tablo')}
            className={cn(
              'flex min-h-9 flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors sm:hidden',
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
              'flex min-h-9 flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors sm:hidden',
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
              'flex min-h-9 min-w-0 flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors sm:hidden',
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
        </div>
      </CardContent>
    </Card>
  );
}
