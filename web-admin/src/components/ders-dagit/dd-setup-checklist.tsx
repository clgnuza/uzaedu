'use client';

import Link from 'next/link';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

export const DD_SETUP_STEPS = [
  { kind: 'count' as const, key: 'classCount', min: 1, href: '/ders-dagit/studyo/kurulum', label: 'Şube tanımlı' },
  { kind: 'period' as const, href: '/ders-dagit/studyo/donem', label: 'Dönem ve saatler' },
  { kind: 'count' as const, key: 'subjectCount', min: 1, href: '/ders-dagit/studyo/dersler', label: 'Dersler' },
  { kind: 'count' as const, key: 'groupCount', min: 0, href: '/ders-dagit/studyo/gruplar', label: 'Gruplar', optional: true },
  { kind: 'count' as const, key: 'teacherCount', min: 1, href: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler' },
  { kind: 'count' as const, key: 'assignmentCount', min: 1, href: '/ders-dagit/studyo/atamalar', label: 'Atamalar' },
  { kind: 'validation' as const, href: '/ders-dagit/studyo/dogrulama', label: 'Ön doğrulama' },
];

function stepOk(
  s: (typeof DD_SETUP_STEPS)[number],
  c: StudioOverview['counts'],
  errs: number,
  periodOk: boolean,
): boolean {
  if (s.kind === 'validation') return errs === 0;
  if (s.kind === 'period') return periodOk;
  return (c[s.key] ?? 0) >= s.min;
}

export function DdSetupChecklist({
  overview,
  className,
}: {
  overview: StudioOverview | null;
  className?: string;
}) {
  if (!overview) return null;
  const c = overview.counts;
  const errs = overview.validation.filter((v) => v.severity === 'error').length;
  const st = overview.studio?.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const periodOk = !!((st?.period?.work_days ?? st?.work_days)?.length);

  return (
    <div className={cn('dd-glass-panel p-3 sm:p-4', className)}>
      <p className="mb-2 text-sm font-semibold">Kurulum kontrol listesi</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DD_SETUP_STEPS.map((s, i) => {
          const ok = stepOk(s, c, errs, periodOk);
          const optional = 'optional' in s && s.optional;
          return (
            <li key={i}>
              <Link
                href={s.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/40',
                  ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border',
                )}
              >
                {ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span>
                  {s.label}
                  {optional && !ok ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">(ops.)</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
