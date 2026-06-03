'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PLANNING_SCOPE_META,
  PLANNING_SCOPE_ORDER,
  type PlanningRuleScope,
} from '@/lib/planning-rule-scope';

type Props = {
  disabled?: boolean;
  onPickScope: (scope: PlanningRuleScope) => void;
  className?: string;
};

export function PlanningRelationScopeCards({ disabled, onPickScope, className }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium">Kural ekle</p>
      <p className="text-xs text-muted-foreground">
        Türüne göre kart seçin; her kuralın formu farklıdır. Varsayılan öncelik Normal — üretimi kilitlemez.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLANNING_SCOPE_ORDER.map((scope) => {
          const m = PLANNING_SCOPE_META[scope];
          return (
            <Button
              key={scope}
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-auto flex-col items-start gap-1 px-3 py-2.5 text-left"
              onClick={() => onPickScope(scope)}
            >
              <span className="flex w-full items-center gap-2">
                <span className="text-lg" aria-hidden>
                  {m.emoji}
                </span>
                <span className="text-sm font-semibold">{m.addTitle}</span>
                <Plus className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
              </span>
              <span className="text-[11px] font-normal leading-snug text-muted-foreground">{m.addHint}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
