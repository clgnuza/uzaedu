'use client';

import type { ComponentType, ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  LayoutGrid,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorContext, ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { TimetableWorkload } from './TimetableWorkload';
import { slotHighlightKey } from '@/lib/timetable-grid-build';
import { auditMatchesProgram, formatAuditAction, formatAuditTime } from '@/lib/timetable-audit-labels';
import { programStatusLabel } from '@/lib/timetable-program-status';

function PoolChip({
  assignmentId,
  label,
  sub,
  hours,
  disabled,
}: {
  assignmentId: string;
  label: string;
  sub: string;
  hours: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${assignmentId}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-xs',
        !disabled && 'cursor-grab touch-manipulation active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
      title="Izgaraya sürükleyin"
    >
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{sub}</div>
      <div className="text-[10px] font-medium text-amber-800 dark:text-amber-200">{hours} saat eksik</div>
    </div>
  );
}

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  user_label: string | null;
  detail?: Record<string, unknown>;
};

function SidebarCard({
  title,
  icon: Icon,
  badge,
  children,
  tone,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string | number;
  children: ReactNode;
  tone?: 'default' | 'danger' | 'ok';
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-card/90 shadow-sm backdrop-blur-sm',
        tone === 'danger' && 'border-destructive/35',
        tone === 'ok' && 'border-emerald-500/30',
        tone === 'default' && 'border-border/70',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="flex-1 text-xs font-semibold tracking-tight">{title}</h3>
        {badge != null && badge !== '' && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{badge}</span>
        )}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function TimetableSidebar({
  unplaced,
  validation,
  clashes,
  entries,
  fairness,
  audit,
  program,
  studioId,
  busy,
  onFocusClash,
  hideUnplaced = false,
}: {
  unplaced: EditorContext['unplaced'];
  validation: ValidationIssue[];
  clashes: EditorContext['clashes'];
  entries: EditorContext['entries'];
  fairness: EditorContext['fairness'];
  audit: AuditRow[];
  program: EditorContext['program'];
  studioId?: string;
  busy: boolean;
  onFocusClash: (slotKey: string, entryId: string) => void;
  hideUnplaced?: boolean;
}) {
  const errors = validation.filter((v) => v.severity === 'error');
  const warns = validation.filter((v) => v.severity !== 'error');
  const clashList = (() => {
    const seen = new Set<string>();
    return clashes.filter((c) => {
      const k = `${c.entry_id}-${c.code}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  })();

  const locked = entries.filter((e) => e.is_locked).length;
  const clashCount = clashList.length;
  const programAudit = audit
    .filter((a) => auditMatchesProgram(a, program.id))
    .slice(0, 12);

  const score = program.score;
  const scoreTone =
    score == null ? 'muted' : score >= 95 ? 'ok' : score >= 80 ? 'mid' : 'low';

  return (
    <aside className="flex w-full shrink-0 flex-col gap-2.5 lg:w-[17rem] xl:w-[18.5rem] print:hidden">
      <SidebarCard title="Program özeti" icon={LayoutGrid}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={program.name ?? undefined}>
              {program.name ?? 'Program'}
            </p>
            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {programStatusLabel(program.status)}
            </span>
          </div>
          {score != null && (
            <div
              className={cn(
                'rounded-lg px-2 py-1 text-center',
                scoreTone === 'ok' && 'bg-emerald-500/15',
                scoreTone === 'mid' && 'bg-amber-500/15',
                scoreTone === 'low' && 'bg-rose-500/15',
              )}
            >
              <p className="text-[10px] text-muted-foreground">Puan</p>
              <p className="text-lg font-bold tabular-nums leading-none">{score}</p>
            </div>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
          <Metric label="Yerleşen saat" value={String(entries.length)} />
          <Metric label="Kilitli" value={String(locked)} />
          <Metric label="Çakışma" value={String(clashCount)} warn={clashCount > 0} />
          <Metric label="Eksik" value={String(unplaced.length)} warn={unplaced.length > 0} />
        </dl>
        {studioId && score != null && score < 100 && (
          <Link
            href="/ders-dagit/studyo/uret"
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--dd-accent))] hover:underline"
          >
            Puan neden 100 değil?
            <ChevronRight className="size-3" />
          </Link>
        )}
      </SidebarCard>

      <SidebarCard title="Öğretmen dengesi" icon={Users}>
        <TimetableWorkload fairness={fairness} studioId={studioId} />
      </SidebarCard>

      {hideUnplaced && unplaced.length > 0 && (
        <div className="rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-xs">
          <p className="font-medium text-primary">{unplaced.length} atanmamış ders</p>
          <p className="mt-0.5 text-muted-foreground">Alttaki çekmeceye sürükleyip ızgaraya bırakın.</p>
        </div>
      )}

      {!hideUnplaced && (
        <SidebarCard title="Atanmamış dersler" icon={Clock} badge={unplaced.length}>
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {unplaced.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Tüm atamalar yerleşmiş.
              </p>
            ) : (
              unplaced.map((u) => (
                <PoolChip
                  key={u.assignment_id}
                  assignmentId={u.assignment_id}
                  label={`${u.class_section} · ${u.subject_name}`}
                  sub={u.teacher_label ?? 'Öğretmen yok'}
                  hours={u.remaining_hours}
                  disabled={busy}
                />
              ))
            )}
          </div>
        </SidebarCard>
      )}

      {clashList.length > 0 && (
        <SidebarCard title="Çakışmalar" icon={AlertTriangle} badge={clashList.length} tone="danger">
          <ul className="max-h-36 space-y-2 overflow-y-auto text-xs">
            {clashList.slice(0, 15).map((c, i) => {
              const ent = entries.find((e) => e.id === c.entry_id);
              const key = ent ? slotHighlightKey(ent.day_of_week, ent.lesson_num) : null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-md px-1 py-0.5 text-left hover:bg-destructive/10"
                    onClick={() => key && onFocusClash(key, c.entry_id)}
                  >
                    <span className="font-medium text-destructive">{c.message}</span>
                    {ent && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {ent.class_section} · {ent.subject} · Gün {ent.day_of_week} Saat {ent.lesson_num}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </SidebarCard>
      )}

      <SidebarCard
        title="Stüdyo doğrulama"
        icon={errors.length ? AlertTriangle : CheckCircle2}
        tone={errors.length ? 'danger' : warns.length ? 'default' : 'ok'}
        badge={errors.length || warns.length || undefined}
      >
        {errors.length === 0 && warns.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Kritik sorun yok
          </p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
            {errors.map((v, i) => (
              <li key={`e-${i}`} className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                {v.message}
                {v.href ? (
                  <Link href={v.href} className="mt-0.5 block font-medium underline">
                    {v.fix_hint ?? 'Düzelt →'}
                  </Link>
                ) : null}
              </li>
            ))}
            {warns.slice(0, 8).map((v, i) => (
              <li key={`w-${i}`} className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-900 dark:text-amber-100">
                {v.message}
              </li>
            ))}
          </ul>
        )}
        {studioId && (
          <Link
            href="/ders-dagit/studyo/dogrulama"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--dd-accent))] hover:underline"
          >
            Tüm kontroller
            <ChevronRight className="size-3" />
          </Link>
        )}
      </SidebarCard>

      {programAudit.length > 0 && (
        <SidebarCard title="Son değişiklikler" icon={History} badge={programAudit.length}>
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {programAudit.map((a) => (
              <li key={a.id} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <p className="text-xs font-medium leading-snug">{formatAuditAction(a.action)}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] text-muted-foreground">
                  <span>{formatAuditTime(a.created_at)}</span>
                  {a.user_label && <span>· {a.user_label}</span>}
                </p>
              </li>
            ))}
          </ul>
        </SidebarCard>
      )}
    </aside>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-md bg-muted/40 px-2 py-1', warn && 'bg-amber-500/15')}>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', warn && 'text-amber-800 dark:text-amber-200')}>{value}</dd>
    </div>
  );
}
