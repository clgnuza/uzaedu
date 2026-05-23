'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SimPendingMove } from '@/lib/timetable-simulation';
import { slotLabel } from '@/lib/timetable-simulation';
import { Check, FlaskConical, RotateCcw, X } from 'lucide-react';

export function TimetableSimulationBar({
  pending,
  clashCount,
  busy,
  onApply,
  onDiscard,
  onReset,
}: {
  pending: SimPendingMove[];
  clashCount: number;
  busy?: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onReset: () => void;
}) {
  const n = pending.length;
  const canApply = n > 0 && clashCount === 0 && !busy;

  return (
    <div
      className={cn(
        'print:hidden sticky top-2 z-20 rounded-xl border border-sky-500/40 bg-sky-50/95 p-3 shadow-md backdrop-blur-sm',
        'dark:border-sky-600/50 dark:bg-sky-950/90',
      )}
      role="region"
      aria-label="Simülasyon modu"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Deneme modu</p>
            <p className="text-xs text-sky-800/90 dark:text-sky-200/80">
              Taşımalar yalnızca önizlemede; <strong>Kaydet</strong> ile programa yazılır.
            </p>
            <ol className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-sky-700/90 dark:text-sky-300/80">
              <li>1 · Dersleri sürükleyin veya tıklayın</li>
              <li>2 · Çakışmaları kontrol edin</li>
              <li>3 · Kaydet veya vazgeç</li>
            </ol>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              n === 0 ? 'bg-muted text-muted-foreground' : 'bg-sky-200/80 text-sky-900 dark:bg-sky-800 dark:text-sky-100',
            )}
          >
            {n === 0 ? 'Değişiklik yok' : `${n} taşıma`}
          </span>
          {clashCount > 0 && (
            <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
              {clashCount} çakışma
            </span>
          )}
          <Button type="button" size="sm" variant="outline" disabled={!n || busy} onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Sıfırla
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onDiscard}>
            <X className="size-3.5" />
            Vazgeç
          </Button>
          <Button type="button" size="sm" disabled={!canApply} onClick={onApply}>
            <Check className="size-3.5" />
            Kaydet
          </Button>
        </div>
      </div>
      {n > 0 && n <= 6 && (
        <ul className="mt-2 max-h-24 overflow-y-auto border-t border-sky-500/20 pt-2 text-[10px] text-sky-900/80 dark:text-sky-100/70">
          {pending.map((m) => (
            <li key={m.entryId} className="truncate">
              {slotLabel(m.fromDay, m.fromLesson)} → {slotLabel(m.toDay, m.toLesson)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
