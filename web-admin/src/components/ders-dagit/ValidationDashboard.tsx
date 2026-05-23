'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, ChevronRight, Circle, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { buildValidationChecklist, type CheckStatus } from '@/lib/ders-dagit-validation-checklist';
import { formatValidationIssueDetail } from '@/lib/ders-dagit-validation-display';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
  if (status === 'fail') return <XCircle className="h-5 w-5 text-rose-500" aria-hidden />;
  if (status === 'warn') return <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />;
  return <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />;
}

function ValidationRing({ pass, total }: { pass: number; total: number }) {
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
  const size = 100;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const tone = pct === 100 ? 'text-emerald-500' : pct >= 70 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted/40" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={cn('stroke-current', tone)}
          strokeWidth={7}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-lg font-bold tabular-nums', tone)}>
          {pass}/{total}
        </span>
        <span className="text-[8px] font-medium uppercase text-muted-foreground">Şart</span>
      </span>
    </div>
  );
}

export function ValidationDashboard({
  issues,
  overview,
  loading,
  canProceed,
  onRefresh,
}: {
  issues: ValidationIssue[];
  overview: StudioOverview | null;
  loading?: boolean;
  canProceed: boolean;
  onRefresh: () => void;
}) {
  const { groups, allRequiredPass, errorCount, warnCount } = buildValidationChecklist(issues, overview);
  const requiredChecks = groups.flatMap((g) => g.checks).filter((c) => c.required);
  const passCount = requiredChecks.filter((c) => c.status === 'pass').length;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-500/10 via-background to-cyan-500/5 p-5 dark:border-teal-800/40">
        <svg className="pointer-events-none absolute -right-2 top-2 h-24 w-24 opacity-15" viewBox="0 0 80 80" aria-hidden>
          <path
            d="M40 6 L44 28 L66 28 L48 42 L56 64 L40 50 L24 64 L32 42 L14 28 L36 28 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-teal-600"
          />
          <path d="M28 40 L36 48 L54 30" fill="none" stroke="currentColor" strokeWidth="3" className="text-teal-500" />
        </svg>
        <div className="relative flex flex-wrap items-start gap-5">
          <ValidationRing pass={passCount} total={requiredChecks.length} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Doğrulama özeti</h1>
            <p className="text-sm text-muted-foreground">
              Tüm zorunlu şartlar {allRequiredPass ? 'sağlanıyor' : 'eksik'} — {errorCount} hata, {warnCount} uyarı
            </p>
            <span
              className={cn(
                'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                allRequiredPass && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                !allRequiredPass && 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
              )}
            >
              {allRequiredPass ? 'Üretime hazır' : 'Üretim engelli'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={onRefresh}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
              Yenile
            </Button>
            <Button type="button" size="sm" disabled={!canProceed} asChild>
              <Link href="/ders-dagit/studyo/uret">Program oluştur</Link>
            </Button>
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <DdCard key={group.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 transition-colors',
                  check.status === 'pass' && 'border-emerald-500/25 bg-emerald-500/5',
                  check.status === 'fail' && 'border-rose-500/30 bg-rose-500/5',
                  check.status === 'warn' && 'border-amber-500/30 bg-amber-500/5',
                  check.status === 'skip' && 'border-border/60 bg-muted/20',
                )}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={check.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{check.label}</p>
                      {!check.required && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">İsteğe bağlı</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{check.description}</p>
                    {check.issues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {check.issues.slice(0, 5).map((v, i) => {
                          const d = formatValidationIssueDetail(v);
                          return (
                            <li
                              key={i}
                              className={cn(
                                'rounded-md px-2 py-1 text-xs',
                                v.severity === 'error'
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-amber-500/10 text-amber-900 dark:text-amber-100',
                              )}
                            >
                              {d.text}
                              {d.hint && (
                                <span className="mt-0.5 block text-muted-foreground">
                                  {d.href ? (
                                    <Link href={d.href} className="text-primary underline">
                                      {d.hint}
                                    </Link>
                                  ) : (
                                    d.hint
                                  )}
                                </span>
                              )}
                            </li>
                          );
                        })}
                        {check.issues.length > 5 && (
                          <li className="text-[10px] text-muted-foreground">+{check.issues.length - 5} kayıt daha</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" asChild>
                    <Link href={check.href}>
                      Düzelt
                      <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </DdCard>
      ))}

      {issues.length > 0 && (
        <DdCard variant={errorCount > 0 ? 'rose' : 'amber'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tüm kayıtlar</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {issues.map((v, i) => {
              const d = formatValidationIssueDetail(v);
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-md px-2 py-1',
                    v.severity === 'error' ? 'text-destructive' : 'text-amber-800 dark:text-amber-200',
                  )}
                >
                  <p>{d.text}</p>
                  {d.hint ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {d.href ? (
                        <Link href={d.href} className="underline">
                          {d.hint}
                        </Link>
                      ) : (
                        d.hint
                      )}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </DdCard>
      )}
    </div>
  );
}
