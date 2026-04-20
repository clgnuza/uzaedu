'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  pending_review: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30',
  published: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30',
  withdrawn: 'bg-muted text-muted-foreground border-border',
};

const LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending_review: 'İncelemede',
  published: 'Yayında',
  rejected: 'Reddedildi',
  withdrawn: 'Geri çekildi',
};

export function PlanKatkiStatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? STYLES.draft!;
  const label = LABELS[status] ?? status;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cls,
      )}
    >
      {label}
    </span>
  );
}
