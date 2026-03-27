'use client';

import { memo } from 'react';
import { scoreRatio01 } from '@/lib/school-review-score';
import { cn } from '@/lib/utils';

export type CriteriaForDisplay = {
  id: string;
  slug: string;
  label: string;
  min_score: number;
  max_score: number;
  hint?: string | null;
};

type Props = {
  criteriaRatings: Record<string, number> | null | undefined;
  criteria: CriteriaForDisplay[] | null | undefined;
  variant?: 'default' | 'public';
  className?: string;
};

function CriteriaRatingsDisplayInner({ criteriaRatings, criteria, variant = 'default', className }: Props) {
  if (!criteriaRatings || !criteria?.length) return null;
  const entries = criteria
    .filter((c) => criteriaRatings[c.slug] != null)
    .map((c) => ({ c, v: criteriaRatings[c.slug]! }));
  if (entries.length === 0) return null;

  const isPublic = variant === 'public';

  return (
    <div className={cn('space-y-2', className)}>
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isPublic ? 'text-slate-500 dark:text-slate-400' : 'text-muted-foreground',
        )}
      >
        Kriter puanları
      </p>
      <ul className="space-y-2">
        {entries.map(({ c, v }) => (
          <li
            key={c.slug}
            className={cn(
              'rounded-lg border px-3 py-2',
              isPublic
                ? 'border-slate-200/90 bg-white/80 dark:border-slate-700/80 dark:bg-slate-900/40'
                : 'border-border/70 bg-muted/35 dark:bg-muted/25',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn('min-w-0 text-sm font-medium leading-snug', isPublic ? 'text-slate-800 dark:text-slate-100' : 'text-foreground')}>
                {c.label}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-md px-2 py-0.5 text-sm font-bold tabular-nums',
                  isPublic
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
                )}
                title={`${c.min_score}–${c.max_score} arası`}
              >
                {v}/{c.max_score}
              </span>
            </div>
            <div
              className={cn('mt-2 h-1.5 overflow-hidden rounded-full', isPublic ? 'bg-slate-200/90 dark:bg-slate-700/60' : 'bg-muted')}
              role="presentation"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  isPublic
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600'
                    : 'bg-gradient-to-r from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-600',
                )}
                style={{ width: `${scoreRatio01(v, c.min_score, c.max_score) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const CriteriaRatingsDisplay = memo(CriteriaRatingsDisplayInner);
