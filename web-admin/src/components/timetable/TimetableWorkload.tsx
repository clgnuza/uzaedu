'use client';

import Link from 'next/link';
import { Scale } from 'lucide-react';
import type { EditorContext } from '@/lib/ders-dagit-timetable-api';
import { cn } from '@/lib/utils';

export function TimetableWorkload({
  fairness,
  studioId,
}: {
  fairness: EditorContext['fairness'];
  studioId?: string;
}) {
  if (!fairness?.ready || !fairness.teacher_stats?.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Öğretmen yükü hesaplanamadı.{' '}
        {studioId ? (
          <Link href="/ders-dagit/studyo/ogretmenler" className="underline">
            Öğretmen ayarları
          </Link>
        ) : null}
      </p>
    );
  }

  const stats = [...fairness.teacher_stats].sort((a, b) => b.lesson_count - a.lesson_count);
  const max = Math.max(...stats.map((t) => t.lesson_count), 1);
  const min = Math.min(...stats.map((t) => t.lesson_count));
  const avg = fairness.avg_lessons_per_teacher ?? 0;
  const spread = max - min;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md bg-muted/50 px-1 py-1">
          <p className="text-[10px] text-muted-foreground">Ort.</p>
          <p className="text-sm font-semibold tabular-nums">{avg.toFixed(1)}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-1 py-1">
          <p className="text-[10px] text-muted-foreground">Min</p>
          <p className="text-sm font-semibold tabular-nums">{min}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-1 py-1">
          <p className="text-[10px] text-muted-foreground">Max</p>
          <p className="text-sm font-semibold tabular-nums">{max}</p>
        </div>
      </div>
      {spread > 2 && (
        <p className="text-[10px] text-amber-800 dark:text-amber-200">
          En yüklü ile en hafif arasında {spread} saat fark var.
        </p>
      )}
      <ul className="max-h-44 space-y-2 overflow-y-auto pr-0.5">
        {stats.map((t) => {
          const over = avg > 0 && t.lesson_count > avg * 1.15;
          const under = avg > 0 && t.lesson_count < avg * 0.85;
          return (
            <li key={t.teacher_id}>
              <div className="mb-0.5 flex items-center justify-between gap-1 text-[11px]">
                <span className="truncate font-medium" title={t.label}>
                  {t.label}
                </span>
                <span
                  className={cn(
                    'shrink-0 tabular-nums font-semibold',
                    over && 'text-amber-700 dark:text-amber-300',
                    under && 'text-sky-700 dark:text-sky-300',
                  )}
                >
                  {t.lesson_count}
                  {t.deviation_from_avg !== 0 && (
                    <span className="ml-0.5 font-normal text-muted-foreground">
                      ({t.deviation_from_avg > 0 ? '+' : ''}
                      {t.deviation_from_avg})
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    over ? 'bg-amber-500/80' : under ? 'bg-sky-500/70' : 'bg-primary/70',
                  )}
                  style={{ width: `${Math.max(8, Math.round((t.lesson_count / max) * 100))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {studioId && (
        <Link
          href="/ders-dagit/studyo/adalet"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--dd-accent))] hover:underline"
        >
          <Scale className="size-3" />
          Adalet raporu
        </Link>
      )}
    </div>
  );
}
