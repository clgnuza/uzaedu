'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, CalendarDays, ListTodo, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ajanda / planlayıcı — öğretmen üst bilgi kartı için SVG */
function AgendaPlannerIcon({ className, size = 48 }: { className?: string; size?: number }) {
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
      <rect x="8" y="6" width="32" height="36" rx="3" className="fill-violet-500/25 dark:fill-violet-400/20" />
      <rect x="11" y="10" width="26" height="14" rx="2" className="fill-sky-500/30 dark:fill-sky-400/25" />
      <path d="M14 24h8M14 28h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-foreground/35" />
      <circle cx="30" cy="32" r="6" className="fill-amber-400/90 dark:fill-amber-500/80" />
      <path
        d="M27.5 32l1.4 1.4L33 29.3"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AgendaHeroSchool() {
  return (
    <Card className="mb-4 overflow-hidden border-sky-200/50 bg-linear-to-br from-sky-500/8 via-background to-violet-500/5 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-900/45 sm:mb-5">
      <CardContent className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300 sm:size-16">
          <Building2 className="size-7 sm:size-8" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">Okul takvimi</h2>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Okul etkinliklerini görüntüleyin ve ekleyin. Öğretmen notları ve görevleri bu görünümde yer almaz.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type Summary = { pendingTasks: number; overdueTasks: number; todayEventCount: number };

export function AgendaHeroTeacher({
  summary,
  weeklyStats,
  onPendingTasks,
  onOverdueTasks,
  onTodayEvents,
}: {
  summary: Summary | null;
  weeklyStats: { total: number; completed: number; completionRate: number } | null;
  onPendingTasks: () => void;
  onOverdueTasks: () => void;
  onTodayEvents: () => void;
}) {
  const pending = summary?.pendingTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const today = summary?.todayEventCount ?? 0;

  return (
    <Card className="mb-2 overflow-hidden border-violet-200/50 bg-linear-to-br from-violet-500/8 via-background to-sky-500/6 shadow-sm ring-1 ring-violet-500/10 dark:border-violet-900/40 dark:from-violet-950/35 dark:to-sky-950/25 sm:mb-5">
      <CardContent className="flex flex-col gap-2 p-2 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
        <div className="flex gap-2 sm:gap-3 sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 sm:size-16 sm:rounded-2xl">
            <AgendaPlannerIcon size={40} className="text-violet-700 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:justify-center">
            <h2 className="text-sm font-bold tracking-tight sm:text-lg">Öğretmen ajandası</h2>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              <span className="max-sm:hidden">Takvim, not, görev ve veli kayıtları tek yerde. Aşağıdan sekme seçin.</span>
              <span className="sm:hidden">Sekmelerden bölüm seçin.</span>
            </p>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-1 border-t border-border/50 pt-2 sm:flex sm:flex-wrap sm:gap-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4 dark:border-border/60',
            'max-sm:grid',
            overdue > 0 ? 'max-sm:grid-cols-4' : 'max-sm:grid-cols-3',
          )}
        >
          <button
            type="button"
            onClick={onPendingTasks}
            className="flex min-h-8 flex-col items-center justify-center gap-0 rounded-lg border border-primary/30 bg-primary/12 px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors hover:bg-primary/18 sm:min-h-9 sm:flex-row sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-xs"
          >
            <ListTodo className="size-3 shrink-0 text-primary sm:size-3.5" />
            <span className="tabular-nums font-bold">{pending}</span>
            <span className="text-[9px] font-normal text-muted-foreground sm:text-xs">bekleyen</span>
          </button>
          {overdue > 0 && (
            <button
              type="button"
              onClick={onOverdueTasks}
              className="flex min-h-8 flex-col items-center justify-center gap-0 rounded-lg border border-destructive/30 bg-destructive/12 px-1 py-1 text-[10px] font-semibold leading-tight text-destructive shadow-sm transition-colors hover:bg-destructive/18 sm:min-h-9 sm:flex-row sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-xs"
            >
              <span className="tabular-nums font-bold">{overdue}</span>
              <span className="text-[9px] font-normal opacity-90 sm:text-xs">gecikmiş</span>
            </button>
          )}
          <button
            type="button"
            onClick={onTodayEvents}
            className="flex min-h-8 flex-col items-center justify-center gap-0 rounded-lg border border-border bg-muted/60 px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors hover:bg-muted sm:min-h-9 sm:flex-row sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-xs"
          >
            <CalendarDays className="size-3 shrink-0 text-muted-foreground sm:size-3.5" />
            <span className="tabular-nums font-bold">{today}</span>
            <span className="text-[9px] font-normal text-muted-foreground sm:text-xs">bugün</span>
          </button>
          <Link
            href="/ogretmen-ajandasi/degerlendirme"
            className={cn(
              'flex min-h-8 flex-col items-center justify-center gap-0 rounded-lg border border-violet-400/45 bg-violet-500/12 px-1 py-1 text-[10px] font-semibold leading-tight shadow-sm transition-colors hover:bg-violet-500/18 sm:min-h-9 sm:flex-row sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-xs',
              'dark:border-violet-700 dark:bg-violet-950/45',
            )}
          >
            <Target className="size-3 shrink-0 text-violet-600 dark:text-violet-400 sm:size-3.5" />
            <span className="max-w-full truncate text-center leading-none sm:hidden">Değerl.</span>
            <span className="hidden sm:inline">Değerlendirme</span>
          </Link>
        </div>

        {weeklyStats ? (
          <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2 sm:min-w-[140px] sm:justify-center sm:gap-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              <span className="font-medium text-foreground">Bu hafta:</span>{' '}
              {weeklyStats.completed}/{weeklyStats.total} görev ·{' '}
              <span className="font-semibold text-primary">%{weeklyStats.completionRate}</span>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
