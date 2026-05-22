'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DdPageHeader,
  DD_PAGE,
  DD_GRID_2,
  DD_CARD_HEADER,
  DD_CARD_CONTENT,
} from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { StudioIssueCards } from './StudioIssueCards';

const PHASE_VARIANT = ['indigo', 'violet', 'teal'] as const;

export function StudioReadinessDashboard({ overview }: { overview: StudioOverview }) {
  const r = computeStudioReadiness(overview);
  const c = overview.counts;

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={LayoutDashboard}
        title="Program merkezi"
        description={`${overview.studio.name} — hazırlık, kurallar ve yayın durumu.`}
      />
      <div className={DD_GRID_2}>
        {(['data', 'rules', 'program'] as const).map((key, i) => {
          const phase = r.phases[key];
          return (
            <DdCard key={key} variant={PHASE_VARIANT[i]}>
              <CardHeader className={DD_CARD_HEADER}>
                <CardTitle className="text-sm">{phase.label}</CardTitle>
                <p className="text-xl font-bold tabular-nums sm:text-2xl">{phase.percent}%</p>
              </CardHeader>
              <CardContent className={DD_CARD_CONTENT}>
                <ul className="space-y-1 text-xs sm:space-y-1.5">
                  {phase.steps.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        className={cn(
                          'inline-flex items-center gap-1.5 hover:underline',
                          s.done && 'text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {s.done ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Circle className="size-3.5 text-muted-foreground" />
                        )}
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </DdCard>
          );
        })}
      </div>

      <DdCard variant="sky">
        <CardHeader className={cn(DD_CARD_HEADER, 'flex flex-row flex-wrap items-center justify-between gap-2')}>
          <CardTitle className="text-base">Sonraki adım</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <span>
              Şube <strong>{c.classCount ?? 0}</strong>
            </span>
            <span>
              Atama <strong>{c.assignmentCount ?? 0}</strong>
            </span>
            <span>
              Program <strong>{c.programCount ?? 0}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'flex flex-wrap items-center gap-2 sm:gap-3')}>
          {!r.canGenerate && r.blockReason && (
            <p className="flex w-full items-center gap-1 text-sm text-destructive sm:w-auto">
              <AlertTriangle className="size-4 shrink-0" />
              {r.blockReason}
            </p>
          )}
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/studyo/dogrulama">Doğrulama</Link>
          </Button>
          <Button type="button" size="sm" disabled={!r.canGenerate} asChild>
            <Link href="/ders-dagit/studyo/uret">
              Üret
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!r.canPublish} asChild>
            <Link href="/ders-dagit/studyo/program">Program tablosu</Link>
          </Button>
        </CardContent>
      </DdCard>

      {(r.errorCount > 0 || r.warnCount > 0) && (
        <StudioIssueCards issues={overview.validation} title="Açık sorunlar" max={8} />
      )}
    </div>
  );
}
