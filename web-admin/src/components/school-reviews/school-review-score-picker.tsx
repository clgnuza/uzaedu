'use client';

import type { ReactNode } from 'react';
import { inclusiveScoreRange } from '@/lib/school-review-score';
import { cn } from '@/lib/utils';

export type ScorePickerCriterion = {
  id: string;
  slug: string;
  label: string;
  hint: string | null;
  min_score: number;
  max_score: number;
};

type Props = {
  criteria: ScorePickerCriterion[] | null | undefined;
  criteriaRatings: Record<string, number>;
  onCriteriaRating: (slug: string, value: number) => void;
  singleRating: number;
  onSingleRating: (value: number) => void;
};

function gridForRange(len: number): string {
  if (len <= 5) return 'grid grid-cols-5 gap-0.5';
  return 'grid grid-cols-5 gap-0.5 sm:grid-cols-10';
}

function scoreBtnClass(selected: boolean): string {
  return cn(
    'touch-manipulation rounded border text-center text-[10px] font-semibold tabular-nums transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50',
    'h-6 min-h-0 min-w-[1.375rem] px-0',
    selected
      ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600'
      : 'border-border/80 bg-muted/40 text-foreground/80 hover:border-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30',
  );
}

function pickerShell(children: ReactNode): ReactNode {
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card text-card-foreground">
      {children}
    </div>
  );
}

export function SchoolReviewScorePicker({
  criteria,
  criteriaRatings,
  onCriteriaRating,
  singleRating,
  onSingleRating,
}: Props) {
  const list = criteria ?? [];

  if (list.length > 0) {
    return pickerShell(
      <ul className="divide-y divide-border/70" role="list" aria-label="Değerlendirme kriterleri">
        {list.map((c, idx) => {
          const nums = inclusiveScoreRange(c.min_score, c.max_score);
          return (
            <li key={c.id} className="px-2 py-1.5 sm:px-2.5">
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="flex min-w-0 items-start gap-1.5 sm:max-w-[42%]">
                  <span
                    className="mt-px flex size-4 shrink-0 items-center justify-center rounded bg-emerald-500/12 text-[9px] font-bold text-emerald-800 dark:text-emerald-200"
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium leading-tight text-foreground">{c.label}</p>
                    {c.hint && (
                      <p className="mt-px line-clamp-2 text-[9px] leading-snug text-muted-foreground">{c.hint}</p>
                    )}
                  </div>
                </div>
                <div className={cn(gridForRange(nums.length), 'min-w-0 shrink-0 sm:max-w-[58%]')} role="group" aria-label={`${c.label} puanı`}>
                  {nums.map((n) => {
                    const selected = (criteriaRatings[c.slug] ?? 0) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onCriteriaRating(c.slug, n)}
                        aria-label={`${c.label}: ${n} puan`}
                        aria-pressed={selected}
                        className={scoreBtnClass(selected)}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>,
    );
  }

  const nums = inclusiveScoreRange(1, 10);
  return pickerShell(
    <div className="px-2 py-1.5 sm:px-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground">Genel puan</span>
        <span className="text-[9px] text-muted-foreground">1 – 10</span>
      </div>
      <div className={cn(gridForRange(nums.length), 'max-w-md')} role="group" aria-label="Genel puan 1–10">
        {nums.map((n) => {
          const selected = singleRating === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSingleRating(n)}
              aria-label={`Genel puan: ${n}`}
              aria-pressed={selected}
              className={scoreBtnClass(selected)}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>,
  );
}
