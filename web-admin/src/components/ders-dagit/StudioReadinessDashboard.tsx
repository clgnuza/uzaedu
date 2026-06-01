'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  GitBranch,
  GraduationCap,
  Heart,
  ListChecks,
  Send,
  TableProperties,
  Users,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { Button } from '@/components/ui/button';
import { StudioIssueCards } from './StudioIssueCards';
import { DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { workflowStatusLabel } from '@/lib/ders-dagit-labels';

const KPI = [
  { key: 'classCount', label: 'Şube', icon: GraduationCap, href: '/ders-dagit/studyo/kurulum', tone: 'text-orange-600 bg-orange-500/10' },
  { key: 'teacherCount', label: 'Öğretmen', icon: Users, href: '/ders-dagit/studyo/ogretmenler', tone: 'text-violet-600 bg-violet-500/10' },
  { key: 'subjectCount', label: 'Ders', icon: BookOpen, href: '/ders-dagit/studyo/dersler', tone: 'text-sky-600 bg-sky-500/10' },
  { key: 'groupCount', label: 'Grup', icon: GitBranch, href: '/ders-dagit/studyo/gruplar', tone: 'text-teal-600 bg-teal-500/10' },
  { key: 'assignmentCount', label: 'Atama', icon: ListChecks, href: '/ders-dagit/studyo/atamalar', tone: 'text-rose-600 bg-rose-500/10' },
  { key: 'programCount', label: 'Program', icon: TableProperties, href: '/ders-dagit/studyo/program', tone: 'text-indigo-600 bg-indigo-500/10' },
] as const;

const PHASE_COLORS = [
  { bar: 'bg-violet-500', ring: 'text-violet-600', bg: 'from-violet-500/10 to-transparent' },
  { bar: 'bg-teal-500', ring: 'text-teal-600', bg: 'from-teal-500/10 to-transparent' },
  { bar: 'bg-amber-500', ring: 'text-amber-600', bg: 'from-amber-500/10 to-transparent' },
] as const;

function ReadinessRing({ percent, size = 88 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const color =
    percent >= 80 ? 'text-emerald-500' : percent >= 50 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted/50" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={cn('stroke-current transition-all duration-500', color)}
          strokeWidth={6}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xl font-bold tabular-nums', color)}>{percent}%</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Hazırlık</span>
      </span>
    </div>
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn('h-full rounded-full transition-all duration-500', className)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function StudioReadinessDashboard({ overview }: { overview: StudioOverview }) {
  const r = computeStudioReadiness(overview);
  const c = overview.counts;
  const st = overview.studio;
  const settings = st.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const workDays = settings?.period?.work_days ?? settings?.work_days ?? [];
  const wf = st.workflow_status ?? 'draft';
  const health = overview.health_score ?? st.health_score ?? 0;

  const phaseKeys = ['data', 'rules', 'program'] as const;
  const doneSteps = phaseKeys.reduce((n, k) => n + r.phases[k].steps.filter((s) => s.done).length, 0);
  const totalSteps = phaseKeys.reduce((n, k) => n + r.phases[k].steps.length, 0);

  return (
    <div className={cn(DD_PAGE, 'pb-6')}>
      {/* Hero */}
      <section className="dd-hero overflow-hidden rounded-2xl border border-border/60 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--dd-accent))]">
              DersDağıt · Özet
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{st.name ?? 'Okul programı'}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              {st.academic_year ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-0.5">
                  <CalendarRange className="size-3.5" />
                  {st.academic_year}
                </span>
              ) : null}
              {workDays.length > 0 ? (
                <span className="rounded-md bg-background/60 px-2 py-0.5">
                  {workDays.length} iş günü / hafta
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold sm:text-xs',
                  wf === 'published'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : wf === 'generated'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
                )}
              >
                {workflowStatusLabel(wf)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <ReadinessRing percent={r.percent} />
            <div className="grid grid-cols-2 gap-3 text-center sm:gap-4">
              <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <div className="flex items-center justify-center gap-1 text-emerald-600">
                  <Heart className="size-3.5" />
                  <span className="text-lg font-bold tabular-nums">{health}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Sağlık</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <span className="text-lg font-bold tabular-nums">
                  {doneSteps}/{totalSteps}
                </span>
                <p className="text-[10px] text-muted-foreground">Adım tamam</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <span className="text-lg font-bold tabular-nums text-destructive">{r.errorCount}</span>
                <p className="text-[10px] text-muted-foreground">Hata</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <span className="text-lg font-bold tabular-nums text-amber-600">{r.warnCount}</span>
                <p className="text-[10px] text-muted-foreground">Uyarı</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veri özeti</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {KPI.map(({ key, label, icon: Icon, href, tone }) => {
            const val = c[key] ?? 0;
            return (
              <Link
                key={key}
                href={href}
                className="group rounded-xl border border-border/60 bg-card p-3 shadow-sm transition hover:border-[rgb(var(--dd-accent))]/40 hover:shadow-md"
              >
                <div className={cn('mb-2 inline-flex rounded-lg p-1.5', tone)}>
                  <Icon className="size-4" aria-hidden />
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight group-hover:text-[rgb(var(--dd-accent))]">
                  {val}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Phases */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hazırlık aşamaları
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {phaseKeys.map((key, i) => {
            const phase = r.phases[key];
            const done = phase.steps.filter((s) => s.done).length;
            const total = phase.steps.length;
            const colors = PHASE_COLORS[i]!;
            return (
              <div
                key={key}
                className={cn(
                  'rounded-xl border border-border/60 bg-gradient-to-b to-card p-4 shadow-sm',
                  colors.bg,
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{phase.label}</p>
                    <p className={cn('text-2xl font-bold tabular-nums', colors.ring)}>{phase.percent}%</p>
                  </div>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <ProgressBar value={phase.percent} className={colors.bar} />
                <ul className="mt-3 space-y-1.5">
                  {phase.steps.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition hover:bg-background/60',
                          s.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground',
                        )}
                      >
                        {s.done ? (
                          <CheckCircle2 className="size-3.5 shrink-0" />
                        ) : (
                          <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{s.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pipeline + actions */}
      <section className="grid gap-3 lg:grid-cols-5">
        <div className="dd-glass-panel rounded-xl p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">İş akışı</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
            {[
              { label: 'Kurulum', href: '/ders-dagit/studyo/kurulum', icon: Building2, ok: r.phases.data.percent >= 80 },
              { label: 'Doğrula', href: '/ders-dagit/studyo/dogrulama', icon: ClipboardCheck, ok: r.errorCount === 0 },
              { label: 'Üret', href: '/ders-dagit/studyo/uret', icon: Wand2, ok: r.canGenerate },
              { label: 'Program', href: '/ders-dagit/studyo/program', icon: TableProperties, ok: (c.programCount ?? 0) > 0 },
              { label: 'Yayın', href: '/ders-dagit/studyo/program?panel=publish', icon: Send, ok: wf === 'published' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex min-w-0 flex-1 items-center gap-1 sm:flex-col sm:items-stretch">
                <Link
                  href={step.href}
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition sm:flex-col sm:text-center',
                    step.ok
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  <step.icon className="size-4 shrink-0 sm:mx-auto" />
                  <span>{step.label}</span>
                  {step.ok && <CheckCircle2 className="ml-auto size-3.5 sm:mx-auto sm:ml-0" />}
                </Link>
                {i < arr.length - 1 && (
                  <ArrowRight className="mx-auto hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[rgb(var(--dd-accent))]/25 bg-[rgb(var(--dd-accent))]/5 p-4 lg:col-span-2">
          <div>
            <h2 className="text-sm font-semibold">Sonraki adım</h2>
            {r.blockReason ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {r.blockReason}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {r.canPublish
                  ? 'Program üretildi — tabloda düzenleyip yayınlayabilirsiniz.'
                  : r.canGenerate
                    ? 'Veriler hazır — otomatik program üretebilirsiniz.'
                    : 'Eksik kurulum adımlarını tamamlayın.'}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" variant="outline" className="w-full justify-center" asChild>
              <Link href="/ders-dagit/studyo/dogrulama">Doğrulama raporu</Link>
            </Button>
            <Button type="button" size="sm" className="w-full justify-center" disabled={!r.canGenerate} asChild>
              <Link href="/ders-dagit/studyo/uret">
                Program üret
                <Wand2 className="ml-1.5 size-3.5" />
              </Link>
            </Button>
            <Button type="button" size="sm" variant="secondary" className="w-full justify-center" disabled={!r.canPublish} asChild>
              <Link href="/ders-dagit/studyo/program">
                Program tablosu
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {(r.errorCount > 0 || r.warnCount > 0) && (
        <StudioIssueCards issues={overview.validation} title="Açık sorunlar" max={10} />
      )}

      {r.errorCount === 0 && r.warnCount === 0 && r.percent >= 80 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="size-5 shrink-0" />
          Kurulum ve doğrulama tamam — program üretimine geçebilirsiniz.
        </div>
      )}
    </div>
  );
}
