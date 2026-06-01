'use client';

import type { FlowStep, FlowStepId } from '@/lib/teacher-availability-flow';
import { cn } from '@/lib/utils';
import {
  BadgeCheck,
  CalendarCheck,
  CircleDot,
  ClipboardList,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

const STEP_ICON: Record<FlowStepId, LucideIcon> = {
  mark: ClipboardList,
  submit: Send,
  review: CalendarCheck,
  applied: BadgeCheck,
};

export function TeacherAvailabilityFlowStepper({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.id];
        return (
          <li
            key={step.id}
            className={cn(
              'relative rounded-xl border px-3 py-2.5 transition-colors',
              step.state === 'done' && 'border-emerald-500/40 bg-emerald-500/8 dark:bg-emerald-950/30',
              step.state === 'current' && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20',
              step.state === 'error' && 'border-destructive/50 bg-destructive/5',
              step.state === 'upcoming' && 'border-border/60 bg-muted/20 opacity-80',
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                  step.state === 'done' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                  step.state === 'current' && 'bg-primary/15 text-primary',
                  step.state === 'error' && 'bg-destructive/10 text-destructive',
                  step.state === 'upcoming' && 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight">{step.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{step.description}</p>
              </div>
              <StepStateIcon state={step.state} index={i + 1} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepStateIcon({ state, index }: { state: FlowStep['state']; index: number }) {
  if (state === 'done') return <BadgeCheck className="size-4 shrink-0 text-emerald-600" />;
  if (state === 'error') return <XCircle className="size-4 shrink-0 text-destructive" />;
  if (state === 'current') return <CircleDot className="size-4 shrink-0 text-primary" />;
  return (
    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{index}</span>
  );
}
