'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatPlanningConditionSummary,
  planningRelationConditionSteps,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';

type Props = {
  row: PlanningRelationRow;
  def: SimpleRelationDef | AdvancedRelationDef | undefined;
  allSections: string[];
  className?: string;
};

export function PlanningRelationConditionPanel({ row, def, allSections, className }: Props) {
  const steps = planningRelationConditionSteps(row, def, allSections);
  const allDone = steps.every((s) => s.done);
  const summary = formatPlanningConditionSummary(row, def);

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-3 text-sm',
        allDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
        className,
      )}
    >
      <p className="text-xs font-medium text-foreground">Koşul özeti</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>
      <ul className="space-y-1.5 pt-1">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-2 text-xs">
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            )}
            <span>
              <span className={s.done ? 'text-foreground' : 'font-medium text-amber-900 dark:text-amber-100'}>
                {s.label}
              </span>
              {s.hint && <span className="mt-0.5 block text-muted-foreground">{s.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
