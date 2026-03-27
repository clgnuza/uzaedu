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
  size?: 'default' | 'compact';
};

function gridForRange(len: number): string {
  if (len <= 5) return 'grid grid-cols-5 gap-1 sm:gap-1.5';
  return 'grid grid-cols-5 gap-1 sm:grid-cols-10 sm:gap-1.5';
}

function scoreBtnClass(selected: boolean, compact: boolean): string {
  return cn(
    'touch-manipulation rounded-md border text-center font-medium tabular-nums transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-1',
    'active:scale-[0.98]',
    compact
      ? 'h-7 min-h-0 min-w-0 text-xs'
      : 'h-8 min-h-[32px] min-w-0 text-xs sm:h-8 sm:text-[13px]',
    selected
      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/25 dark:border-emerald-500 dark:bg-emerald-600 dark:ring-emerald-400/20'
      : 'border-slate-200/90 bg-slate-50/90 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/90 hover:text-emerald-900 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-emerald-700/80 dark:hover:bg-emerald-950/35 dark:hover:text-emerald-100',
  );
}

function criterionShell(compact: boolean, children: ReactNode): ReactNode {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/95 bg-white shadow-sm dark:border-slate-600/90 dark:bg-slate-900/95',
        'ring-1 ring-slate-900/3 dark:ring-white/6',
        compact && 'rounded-lg',
      )}
    >
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
  size = 'default',
}: Props) {
  const compact = size === 'compact';
  const list = criteria ?? [];

  if (list.length > 0) {
    return (
      <div className={cn('flex flex-col gap-4', compact && 'gap-3')} role="list" aria-label="Değerlendirme kriterleri">
        {list.map((c, idx) => {
          const nums = inclusiveScoreRange(c.min_score, c.max_score);
          return (
            <div key={c.id}>
              {criterionShell(
                compact,
                <>
                  <div
                    className={cn(
                      'border-b border-slate-100 bg-linear-to-r from-slate-50/95 to-emerald-50/40 px-3 py-2.5 dark:border-slate-700/90 dark:from-slate-800/70 dark:to-emerald-950/25',
                      compact && 'px-2.5 py-2',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-600/12 text-[10px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                        aria-hidden
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-snug text-slate-800 dark:text-slate-100">{c.label}</p>
                        {c.hint && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{c.hint}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn('p-3 dark:bg-slate-950/20', compact && 'p-2.5')}>
                    <div className={gridForRange(nums.length)} role="group" aria-label={`${c.label} puanı`}>
                      {nums.map((n) => {
                        const selected = (criteriaRatings[c.slug] ?? 0) === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => onCriteriaRating(c.slug, n)}
                            aria-label={`${c.label}: ${n} puan`}
                            aria-pressed={selected}
                            className={scoreBtnClass(selected, compact)}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>,
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const nums = inclusiveScoreRange(1, 10);
  return criterionShell(compact, (
    <>
      <div className="border-b border-slate-100 bg-linear-to-r from-slate-50/95 to-sky-50/50 px-3 py-2.5 dark:border-slate-700/90 dark:from-slate-800/70 dark:to-sky-950/30">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Genel puan</span>
          <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            1 – 10
          </span>
        </div>
      </div>
      <div className="p-3 dark:bg-slate-950/20 sm:p-3.5">
        <div className={cn(gridForRange(nums.length), 'max-w-xl')} role="group" aria-label="Genel puan 1–10">
          {nums.map((n) => {
            const selected = singleRating === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSingleRating(n)}
                aria-label={`Genel puan: ${n}`}
                aria-pressed={selected}
                className={scoreBtnClass(selected, compact)}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span>Düşük</span>
          <span>Yüksek</span>
        </div>
      </div>
    </>
  ));
}
