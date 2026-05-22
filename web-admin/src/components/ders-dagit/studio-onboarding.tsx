'use client';

import Link from 'next/link';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

import { DD_SETUP_STEPS } from '@/components/ders-dagit/dd-setup-checklist';

const STEPS = DD_SETUP_STEPS;

export function StudioOnboarding({ overview }: { overview: StudioOverview | null }) {
  if (!overview) return null;
  const c = overview.counts;
  const errs = overview.validation.filter((v) => v.severity === 'error').length;
  const st = overview?.studio?.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const periodOk = !!((st?.period?.work_days ?? st?.work_days)?.length);
  const done =
    STEPS.every((s) => {
      if (s.kind === 'validation') return errs === 0;
      if (s.kind === 'period') return periodOk;
      return (c[s.key] ?? 0) >= s.min;
    }) && errs === 0;
  if (done && overview.studio.workflow_status === 'published') return null;

  return (
    <div className="dd-onboarding px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="mb-1.5 text-xs font-semibold text-teal-900 dark:text-teal-100 sm:text-sm">Kurulum adımları</p>
      <ul className="dd-nav-scroll flex gap-2 overflow-x-auto text-xs sm:flex-wrap sm:gap-3 sm:text-sm">
        {STEPS.map((s, i) => {
          const ok =
            s.kind === 'validation'
              ? errs === 0
              : s.kind === 'period'
                ? periodOk
                : (c[s.key as keyof typeof c] ?? 0) >= s.min;
          return (
            <li key={i} className="shrink-0">
              <Link
                href={s.href}
                className={cn(
                  'inline-flex items-center gap-1 whitespace-nowrap hover:underline',
                  ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground',
                )}
              >
                {ok ? <CheckCircle2 className="size-3.5 sm:size-4" /> : <Circle className="size-3.5 text-muted-foreground sm:size-4" />}
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
