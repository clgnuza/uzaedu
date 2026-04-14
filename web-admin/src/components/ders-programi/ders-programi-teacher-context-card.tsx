'use client';

import { cn } from '@/lib/utils';
import { DersProgramiWeekIllustration } from '@/components/ders-programi/ders-programi-week-illustration';

type Props = {
  dateStr: string;
  weekdayStr: string;
  timeStr: string;
  educationModeLabel: string;
  isClassTime: boolean;
  todayLessons: number;
  weekTotalSlots: number;
  academicYear: string;
  className?: string;
  children?: React.ReactNode;
  /** Rozet satırına ek (ör. okul yöneticisi: öğretmen sayısı) */
  extraBadges?: React.ReactNode;
  /** Varsayılan “Bugün … ders” satırının yerine */
  statsSlot?: React.ReactNode;
};

/**
 * Öğretmen ders programı üst özeti: çoklu kart/bant yerine tek bilgi kartı + isteğe bağlı aksiyonlar.
 */
export function DersProgramiTeacherContextCard({
  dateStr,
  weekdayStr,
  timeStr,
  educationModeLabel,
  isClassTime,
  todayLessons,
  weekTotalSlots,
  academicYear,
  className,
  children,
  extraBadges,
  statsSlot,
}: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-sky-200/50 bg-linear-to-br from-sky-500/7 via-background to-violet-500/6 p-2 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-900/40 dark:from-sky-950/40 dark:to-violet-950/25 dark:ring-sky-900/30 sm:rounded-2xl sm:p-4',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-sky-400/15 blur-2xl dark:bg-sky-500/20"
        aria-hidden
      />
      <div className="relative flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <DersProgramiWeekIllustration className="size-14 shrink-0 sm:size-20" />
        <div className="min-w-0 flex-1 space-y-1 overflow-hidden sm:space-y-2">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2 sm:gap-y-1.5">
            <span className="rounded-full border border-sky-300/50 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-900 dark:border-sky-700 dark:text-sky-200">
              {academicYear}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                isClassTime
                  ? 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {isClassTime ? 'Şimdi ders saati' : 'Ders saati dışı'}
            </span>
            <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {educationModeLabel}
            </span>
            {extraBadges}
          </div>
          <p className="wrap-break-word text-xs font-semibold leading-tight text-foreground sm:text-base">
            {dateStr} · {weekdayStr}
            <span className="font-normal text-muted-foreground"> · {timeStr}</span>
          </p>
          {statsSlot ?? (
            <>
              <p className="wrap-break-word text-[11px] leading-tight text-muted-foreground sm:hidden">
                Bugün <span className="font-semibold tabular-nums text-foreground">{todayLessons}</span> ders ·{' '}
                <span className="font-semibold tabular-nums text-foreground">{weekTotalSlots}</span> kayıt
              </p>
              <p className="hidden wrap-break-word text-xs leading-snug text-muted-foreground sm:block sm:text-sm">
                Bugün <span className="font-semibold tabular-nums text-foreground">{todayLessons}</span> ders · Haftalık tabloda{' '}
                <span className="font-semibold tabular-nums text-foreground">{weekTotalSlots}</span> kayıt
              </p>
            </>
          )}
        </div>
        {children ? (
          <div className="flex w-full min-w-0 flex-row flex-wrap gap-1.5 *:min-h-9 *:min-w-0 *:flex-1 sm:w-auto sm:max-w-full sm:flex-col sm:gap-2 sm:*:flex-none sm:shrink-0 md:min-w-[200px] md:max-w-[280px]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
