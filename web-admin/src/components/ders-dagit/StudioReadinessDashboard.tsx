'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StudioIssueCards } from './StudioIssueCards';

export function StudioReadinessDashboard({ overview }: { overview: StudioOverview }) {
  const r = computeStudioReadiness(overview);
  const c = overview.counts;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {(['data', 'rules', 'program'] as const).map((key) => {
          const phase = r.phases[key];
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{phase.label}</CardTitle>
                <p className="text-2xl font-bold tabular-nums">{phase.percent}%</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-xs">
                  {phase.steps.map((s) => (
                    <li key={s.id}>
                      <Link href={s.href} className={cn('inline-flex items-center gap-1.5 hover:underline', s.done && 'text-emerald-700 dark:text-emerald-300')}>
                        {s.done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5 text-muted-foreground" />}
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Sonraki adım</CardTitle>
          <div className="flex flex-wrap gap-2 text-sm">
            <span>Sınıf <strong>{c.classCount ?? 0}</strong></span>
            <span>Atama <strong>{c.assignmentCount ?? 0}</strong></span>
            <span>Program <strong>{c.programCount ?? 0}</strong></span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {!r.canGenerate && r.blockReason && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              {r.blockReason}
            </p>
          )}
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/stüdyo/dogrulama">Doğrulama</Link>
          </Button>
          <Button type="button" size="sm" disabled={!r.canGenerate} asChild>
            <Link href="/ders-dagit/stüdyo/uret">
              Üret
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!r.canPublish} asChild>
            <Link href="/ders-dagit/stüdyo/program">Program editörü</Link>
          </Button>
        </CardContent>
      </Card>

      {(r.errorCount > 0 || r.warnCount > 0) && (
        <StudioIssueCards issues={overview.validation} title="Açık sorunlar" max={8} />
      )}
    </div>
  );
}
