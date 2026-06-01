'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export type AssignmentCapacityWarning = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export function AssignmentCapacityAlerts({ warnings }: { warnings: AssignmentCapacityWarning[] }) {
  if (!warnings.length) return null;
  const errors = warnings.filter((w) => w.severity === 'error');
  const warns = warnings.filter((w) => w.severity === 'warning');
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Kapasite kontrolü
      </p>
      {errors.map((w, i) => (
        <div
          key={`e-${w.code}-${i}`}
          className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/8 px-2.5 py-2 text-xs text-destructive"
        >
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{w.message}</span>
        </div>
      ))}
      {warns.map((w, i) => (
        <div
          key={`w-${w.code}-${i}`}
          className="flex gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
