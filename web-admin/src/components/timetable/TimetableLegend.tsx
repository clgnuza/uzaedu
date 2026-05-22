'use client';

import { SLOT_STATUS_CELL } from '@/lib/timetable-slot-status';

export function TimetableLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground print:hidden">
      <span className="inline-flex items-center gap-1">
        <span className={cnBox(SLOT_STATUS_CELL.ok)} /> Uygun
      </span>
      <span className="inline-flex items-center gap-1">
        <span className={cnBox(SLOT_STATUS_CELL.swap)} /> Takas
      </span>
      <span className="inline-flex items-center gap-1">
        <span className={cnBox(SLOT_STATUS_CELL.occupied)} /> Çakışma
      </span>
      <span className="inline-flex items-center gap-1">
        <span className={cnBox(SLOT_STATUS_CELL.forbidden)} /> Yasak
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-3 rounded border-l-4 border-destructive bg-card" /> Çakışma şeridi
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-3 rounded border-r-4 border-white bg-card shadow-sm" /> Derslik yok
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-3 rounded bg-amber-100 dark:bg-amber-900/40" /> Öğle
      </span>
      <LockIcon /> Kilitli
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
      Kilitli
    </span>
  );
}
