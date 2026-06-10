'use client';

import { ListChecks, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BEHAVIOR_PRESETS } from './behavior-presets-grid';

type Criterion = {
  id: string;
  name: string;
  maxScore: number;
  scoreType?: 'numeric' | 'sign';
};

export function DefinedBehaviorCriteriaGrid({
  criteria,
  onEdit,
  onDelete,
}: {
  criteria: Criterion[];
  onEdit: (c: Criterion) => void;
  onDelete: (id: string) => void;
}) {
  if (criteria.length === 0) return null;

  return (
    <section className="mt-1 space-y-2.5 rounded-2xl border border-emerald-200/50 bg-linear-to-br from-slate-50/90 via-card to-emerald-50/25 p-3 shadow-sm dark:border-emerald-900/35 dark:from-slate-900/40 dark:via-card dark:to-emerald-950/15">
      <div className="flex items-center gap-2 border-b border-emerald-200/40 pb-2 dark:border-emerald-900/30">
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-700 dark:text-emerald-300">
          <ListChecks className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">Tanımlı davranışlar</p>
          <p className="text-[10px] text-muted-foreground">{criteria.length} kalıcı kriter</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {criteria.map((c) => {
          const preset = BEHAVIOR_PRESETS.find((p) => p.name === c.name);
          const Icon = preset?.Icon ?? Sparkles;
          const scoreLabel = (c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`;
          const negative = preset?.polarity === 'negative';

          return (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-xs transition-colors',
                negative
                  ? 'border-rose-200/70 dark:border-rose-900/40'
                  : 'border-emerald-200/60 dark:border-emerald-900/35',
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                  negative
                    ? 'border-rose-200/60 bg-rose-500/8 text-rose-700 dark:border-rose-900/40 dark:text-rose-300'
                    : 'border-emerald-200/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-300',
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">{c.name}</p>
                <span className="mt-1 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {scoreLabel}
                </span>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(c)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Düzenle"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                  title="Sil"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
