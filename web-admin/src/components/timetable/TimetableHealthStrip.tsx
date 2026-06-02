'use client';

import { cn } from '@/lib/utils';
import type { EditorContext } from '@/lib/ders-dagit-timetable-api';
import { programStatusLabel } from '@/lib/timetable-program-status';

export function TimetableHealthStrip({
  ctx,
  clashCount,
  simulate,
  pendingMoves = 0,
}: {
  ctx: EditorContext;
  clashCount: number;
  simulate?: boolean;
  pendingMoves?: number;
}) {
  const unplacedCount = ctx.unplaced.length;
  const unplacedHours = ctx.unplaced.reduce((s, u) => s + (u.remaining_hours ?? 0), 0);
  const locked = ctx.entries.filter((e) => e.is_locked).length;
  const total = ctx.entries.length;
  const ok = clashCount === 0 && unplacedHours === 0;

  return (
    <div
      className={cn(
        'print:hidden flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
        simulate && 'border-sky-500/50 bg-sky-50/80 dark:bg-sky-950/30',
        !simulate && ok && 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20',
        !simulate && !ok && 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20',
      )}
    >
      {simulate && (
        <span className="font-semibold text-sky-800 dark:text-sky-200">
          Deneme modu
          {pendingMoves > 0 ? ` · ${pendingMoves} taşıma` : ''}
        </span>
      )}
      <Metric label="Ders saati" value={String(total)} ok />
      <Metric label="Çakışma" value={String(clashCount)} ok={clashCount === 0} bad={clashCount > 0} />
      <Metric
        label="Yerleşmemiş"
        value={unplacedCount > 0 ? `${unplacedCount} · ${unplacedHours} sa` : '0'}
        ok={unplacedHours === 0}
        bad={unplacedHours > 0}
      />
      <Metric label="Kilitli" value={String(locked)} ok />
      {ctx.program.score != null && (
        <span className="ml-auto text-muted-foreground">
          Puan <strong className="text-foreground">{ctx.program.score}</strong>
        </span>
      )}
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
        {programStatusLabel(ctx.program.status)}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  ok,
  bad,
}: {
  label: string;
  value: string;
  ok?: boolean;
  bad?: boolean;
}) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5',
        bad && 'bg-destructive/15 font-semibold text-destructive',
        ok && !bad && 'bg-muted/80',
      )}
    >
      {label}: {value}
    </span>
  );
}
