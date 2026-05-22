'use client';

import Link from 'next/link';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

const STEPS: Array<
  | { kind: 'count'; key: string; min: number; href: string; label: string }
  | { kind: 'validation'; href: string; label: string }
  | { kind: 'period'; href: string; label: string }
> = [
  { kind: 'count', key: 'classCount', min: 1, href: '/ders-dagit/stüdyo/kurulum', label: 'Sınıf profili' },
  { kind: 'period', href: '/ders-dagit/stüdyo/donem', label: 'Dönem' },
  { kind: 'count', key: 'subjectCount', min: 1, href: '/ders-dagit/stüdyo/dersler', label: 'Dersler' },
  { kind: 'count', key: 'groupCount', min: 0, href: '/ders-dagit/stüdyo/gruplar', label: 'Gruplar (opsiyonel)' },
  { kind: 'count', key: 'teacherCount', min: 1, href: '/ders-dagit/stüdyo/ogretmenler', label: 'Öğretmenler' },
  { kind: 'count', key: 'assignmentCount', min: 1, href: '/ders-dagit/stüdyo/atamalar', label: 'Atamalar' },
  { kind: 'validation', href: '/ders-dagit/stüdyo/dogrulama', label: 'Ön doğrulama' },
];

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
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="mb-2 text-sm font-medium">Kurulum adımları</p>
      <ul className="flex flex-wrap gap-3 text-sm">
        {STEPS.map((s, i) => {
          const ok =
            s.kind === 'validation' ? errs === 0 : s.kind === 'period' ? periodOk : (c[s.key] ?? 0) >= s.min;
          return (
            <li key={i}>
              <Link
                href={s.href}
                className={cn('inline-flex items-center gap-1.5 hover:underline', ok ? 'text-emerald-700 dark:text-emerald-300' : '')}
              >
                {ok ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 text-muted-foreground" />}
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
