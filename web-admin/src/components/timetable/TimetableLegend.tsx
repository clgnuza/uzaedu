'use client';

import { SLOT_CLOSED_STATIC, SLOT_STATUS_CELL } from '@/lib/timetable-slot-status';

export function TimetableLegend({
  compareActive,
  compareCounts,
}: {
  compareActive?: boolean;
  compareCounts?: {
    same: number;
    modified: number;
    moved: number;
    added: number;
    removed: number;
  };
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground print:hidden">
      {compareActive && (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Karşılaştırma</span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded ring-1 ring-amber-500 bg-amber-50 dark:bg-amber-950/50" /> Değişen içerik
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded ring-1 ring-dashed ring-orange-500 bg-orange-50 dark:bg-orange-950/50" /> Taşınan
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded ring-1 ring-sky-600 bg-sky-50 dark:bg-sky-950/50" /> Yeni
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded ring-1 ring-rose-600 bg-rose-50 dark:bg-rose-950/50" /> Kaldırılan
          </span>
          {compareCounts && (
            <span className="text-foreground/60">
              ({compareCounts.modified + compareCounts.moved + compareCounts.added + compareCounts.removed} fark)
            </span>
          )}
          <span className="hidden sm:inline h-3 w-px bg-border" aria-hidden />
        </>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Sürükle-bırak</span>
      <span className="inline-flex items-center gap-1">
        {cnBox(SLOT_STATUS_CELL.ok)} Uygun
      </span>
      <span className="inline-flex items-center gap-1">
        {cnBox(SLOT_STATUS_CELL.swap)} Takas
      </span>
      <span className="inline-flex items-center gap-1">
        {cnBox(SLOT_STATUS_CELL.occupied)} Çakışma
      </span>
      <span className="inline-flex items-center gap-1">
        {cnBox(SLOT_CLOSED_STATIC)} Kapalı saat
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-3 rounded bg-amber-200 dark:bg-amber-900/50 ring-1 ring-amber-400/40" /> Öğle
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-3 rounded ring-2 ring-destructive/80" /> Program çakışması
      </span>
      <LockIcon />
    </div>
  );
}

function cnBox(cls: string) {
  return <span className={`size-3 rounded border border-border ${cls}`} />;
}

function LockIcon() {
  return (
    <span className="inline-flex items-center gap-1">
      <svg className="size-3 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="11" width="14" height="10" rx="1" />
        <path d="M8 11V8a4 4 0 118 0v3" />
      </svg>
      Kilitli ders
    </span>
  );
}
