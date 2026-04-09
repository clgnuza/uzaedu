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
  /** public: genel ortalama ilk küçük kartta */
  headerRating?: { value: number; max: number };
  className?: string;
};

function resolveCriterion(
  slug: string,
  criteria: CriteriaForDisplay[] | null | undefined,
): CriteriaForDisplay {
  const found = criteria?.find((x) => x.slug === slug);
  if (found) return found;
  return {
    id: slug,
    slug,
    label: slug.replace(/_/g, ' '),
    min_score: 1,
    max_score: 10,
    hint: null,
  };
}

function buildEntries(
  criteriaRatings: Record<string, number>,
  criteria: CriteriaForDisplay[] | null | undefined,
): { c: CriteriaForDisplay; v: number }[] {
  return Object.entries(criteriaRatings)
    .filter(([, v]) => v != null && !Number.isNaN(Number(v)))
    .map(([slug, raw]) => {
      const v = Number(raw);
      const c = resolveCriterion(slug, criteria);
      return { c, v };
    });
}

function CriteriaRatingsDisplayInner({
  criteriaRatings,
  criteria,
  variant = 'default',
  headerRating,
  className,
}: Props) {
  if (!criteriaRatings || Object.keys(criteriaRatings).length === 0) return null;
  const entries = buildEntries(criteriaRatings, criteria);
  if (entries.length === 0) return null;

  const isPublic = variant === 'public';

  if (isPublic) {
    return (
      <div className={cn('w-full min-w-0 max-w-full space-y-2', className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Puan özeti
        </p>
        {/* Sadece bu şerit kayar; sayfa genişlemez (min-w-0 + dış overflow) */}
        <div
          className="w-full min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600"
        >
          <ul
            className="flex w-max max-w-none snap-x snap-mandatory flex-nowrap gap-2 pb-1 pt-0.5"
            aria-label="Kriter puanları"
          >
          {headerRating != null && (
            <li className="flex w-[5.75rem] shrink-0 snap-start flex-col justify-between rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white px-2 py-1.5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-slate-900 sm:w-24">
              <span className="text-[9px] font-medium uppercase leading-tight text-amber-800/90 dark:text-amber-200/90">
                Genel
              </span>
              <div className="mt-0.5 flex items-baseline gap-0.5 tabular-nums">
                <span className="text-base font-bold leading-none text-slate-900 dark:text-white">
                  {headerRating.value.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">/{headerRating.max}</span>
              </div>
            </li>
          )}
          {entries.map(({ c, v }) => (
            <li
              key={c.slug}
              className="flex w-[5.75rem] shrink-0 snap-start flex-col justify-between rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-950/50 sm:w-24"
            >
              <span
                className="line-clamp-3 text-[9px] font-medium leading-tight text-slate-600 dark:text-slate-300"
                title={c.label}
              >
                {c.label}
              </span>
              <div className="mt-1 text-center">
                <span className="inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200">
                  {v}/{c.max_score}
                </span>
              </div>
              <div
                className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ width: `${scoreRatio01(v, c.min_score, c.max_score) * 100}%` }}
                />
              </div>
            </li>
          ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kriter puanları</p>
      <ul className="space-y-2">
        {entries.map(({ c, v }) => (
          <li
            key={c.slug}
            className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 dark:bg-muted/25"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-medium leading-snug text-foreground">{c.label}</span>
              <span
                className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-900 dark:text-amber-100"
                title={`${c.min_score}–${c.max_score} arası`}
              >
                {v}/{c.max_score}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-600"
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
