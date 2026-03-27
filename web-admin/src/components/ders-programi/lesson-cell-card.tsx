'use client';

import Link from 'next/link';
import { Clock, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LessonCellCardProps = {
  subject: string;
  classSection: string;
  timeRange: string;
  onRemove?: () => void;
  onView?: () => void;
  /** Varsa kazanım takip sayfasına gider; tıklanabilir */
  kazanimHref?: string;
  editable?: boolean;
  compact?: boolean;
  /** 0–6: hafta günü pastel teması (Pzt–Paz); compact öğretmen tablosu için */
  dayTone?: number;
  /**
   * Kişisel program düzenleme tablosu: hücreyi doldurur, içerik ortalanır,
   * mobilde dokunma için kaldır düğmesi görünür kalır.
   */
  teacherCell?: boolean;
};

/** Öğretmen tablosu: güne göre pastel kart kenarlığı ve zemin */
const COMPACT_DAY_TONE = [
  'border-sky-200/70 bg-linear-to-br from-sky-50/95 to-sky-100/70 text-sky-950 dark:border-sky-800/50 dark:from-sky-950/40 dark:to-sky-900/25 dark:text-sky-50',
  'border-emerald-200/70 bg-linear-to-br from-emerald-50/95 to-emerald-100/70 text-emerald-950 dark:border-emerald-800/50 dark:from-emerald-950/40 dark:to-emerald-900/25 dark:text-emerald-50',
  'border-violet-200/70 bg-linear-to-br from-violet-50/95 to-violet-100/70 text-violet-950 dark:border-violet-800/50 dark:from-violet-950/40 dark:to-violet-900/25 dark:text-violet-50',
  'border-amber-200/70 bg-linear-to-br from-amber-50/95 to-amber-100/70 text-amber-950 dark:border-amber-800/50 dark:from-amber-950/40 dark:to-amber-900/25 dark:text-amber-50',
  'border-rose-200/70 bg-linear-to-br from-rose-50/95 to-rose-100/70 text-rose-950 dark:border-rose-800/50 dark:from-rose-950/40 dark:to-rose-900/25 dark:text-rose-50',
  'border-cyan-200/70 bg-linear-to-br from-cyan-50/95 to-cyan-100/65 text-cyan-950 dark:border-cyan-800/50 dark:from-cyan-950/40 dark:to-cyan-900/25 dark:text-cyan-50',
  'border-indigo-200/70 bg-linear-to-br from-indigo-50/95 to-indigo-100/65 text-indigo-950 dark:border-indigo-800/50 dark:from-indigo-950/40 dark:to-indigo-900/25 dark:text-indigo-50',
] as const;

/** Ders hücresi kartı – tablo içinde sınıf-ders bilgisi ve opsiyonel saat. */
export function LessonCellCard({
  subject,
  classSection,
  timeRange,
  onRemove,
  onView,
  kazanimHref,
  editable = false,
  compact = false,
  dayTone,
  teacherCell = false,
}: LessonCellCardProps) {
  const toneIdx =
    dayTone !== undefined && dayTone >= 0 && dayTone < COMPACT_DAY_TONE.length ? dayTone : null;
  const pastelTone = compact && toneIdx !== null ? COMPACT_DAY_TONE[toneIdx] : null;

  const teacherCellContent = teacherCell && !compact && (
    <div
      className={cn(
        'group relative flex h-full min-h-14 w-full max-w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-center shadow-sm transition-all',
        'border-primary/25 bg-linear-to-b from-primary/7 to-primary/12 sm:min-h-16 sm:gap-1 sm:px-2 sm:py-2',
        'touch-manipulation',
      )}
    >
      {editable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'absolute right-0.5 top-0.5 z-10 rounded p-1 text-destructive transition-colors hover:bg-destructive/15',
            'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 opacity-100',
          )}
          title="Kaldır"
        >
          <X className="size-3.5" />
        </button>
      )}
      <p className="line-clamp-2 w-full px-0.5 text-[11px] font-bold leading-tight text-foreground sm:text-xs">{subject}</p>
      {classSection ? (
        <span className="inline-flex max-w-[98%] items-center justify-center truncate rounded bg-background/75 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-foreground/90 ring-1 ring-border/40 sm:text-[10px]">
          {classSection}
        </span>
      ) : null}
      <div className="flex items-center justify-center gap-0.5 text-[9px] tabular-nums text-muted-foreground sm:text-[10px]">
        <Clock className="size-2.5 shrink-0 opacity-85" aria-hidden />
        <span className="max-w-36 truncate">{timeRange}</span>
      </div>
    </div>
  );

  const content = teacherCellContent ? (
    teacherCellContent
  ) : (
    <div
      className={cn(
        'group rounded-lg border shadow-sm transition-all',
        pastelTone
          ? cn(
              pastelTone,
              kazanimHref && 'cursor-pointer hover:brightness-[0.98] hover:shadow-md dark:hover:brightness-110',
            )
          : cn(
              'border-primary/15 bg-linear-to-br from-primary/5 to-primary/10',
              kazanimHref && 'cursor-pointer hover:border-primary/30 hover:shadow-md hover:from-primary/8 hover:to-primary/15',
            ),
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {compact && classSection ? (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 truncate">{classSection}</div>
              <div className="text-xs font-semibold leading-snug text-foreground line-clamp-2">{subject}</div>
            </>
          ) : (
            <div className="font-semibold text-foreground text-xs leading-tight truncate">
              {classSection ? `${classSection} · ${subject}` : subject}
            </div>
          )}
          {!compact && (
            <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              {timeRange}
            </div>
          )}
          {compact && timeRange && (
            <div className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground/90">
              <Clock className="size-2.5 shrink-0 opacity-80" />
              <span className="truncate">{timeRange}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {kazanimHref && !editable && (
            <span
              className={cn(
                'rounded-md p-1 transition-colors',
                pastelTone ? 'text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10' : 'text-primary hover:bg-primary/20',
              )}
              title="Kazanımlara git"
            >
              <Eye className="size-3.5" />
            </span>
          )}
          {onView && !kazanimHref && !editable && (
            <button
              type="button"
              onClick={onView}
              className="rounded-md p-1 text-primary hover:bg-primary/20 transition-colors"
              title="Detay"
            >
              <Eye className="size-3.5" />
            </button>
          )}
          {editable && onRemove && !teacherCell && (
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-destructive hover:bg-destructive/15 transition-all"
              title="Kaldır"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (kazanimHref) {
    return <Link href={kazanimHref} className="block">{content}</Link>;
  }
  return content;
}
