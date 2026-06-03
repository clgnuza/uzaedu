'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Crosshair, Minus } from 'lucide-react';
import type { ProgramScoreBreakdown } from '@/lib/ders-dagit-score-breakdown';
import { groupScoreDeductions, type ScoreDeductionGroup } from '@/lib/score-breakdown-groups';
import { canHighlightGroup } from '@/lib/score-breakdown-focus';
import { cn } from '@/lib/utils';

function ScoreGauge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const full = score >= max;

  return (
    <div className="relative size-20 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/25" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-700',
            full ? 'text-emerald-500' : 'text-[rgb(var(--dd-accent))]',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ {max}</span>
      </div>
    </div>
  );
}

export function ProgramScoreBreakdownPanel({
  breakdown,
  title = 'Puan özeti',
  className,
  activeGroupId,
  onSelectGroup,
  focusHint,
}: {
  breakdown: ProgramScoreBreakdown;
  title?: string;
  className?: string;
  activeGroupId?: string | null;
  onSelectGroup?: (group: ScoreDeductionGroup) => void;
  focusHint?: string | null;
}) {
  const full = breakdown.points_to_full <= 0;
  const groups = useMemo(() => groupScoreDeductions(breakdown), [breakdown]);
  const rawCount = breakdown.deductions.length;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-gradient-to-br from-card/95 via-card/80 to-muted/20 shadow-sm backdrop-blur-sm',
        full ? 'border-emerald-500/35' : 'border-[rgb(var(--dd-accent))]/25',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-border/50 px-4 py-3.5">
        <ScoreGauge score={breakdown.score} max={breakdown.max_score} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          {full ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Tüm kriterler karşılandı — tam puan.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground tabular-nums">{groups.length}</strong> konu
              {rawCount > groups.length ? (
                <>
                  {' '}
                  (<span className="tabular-nums">{rawCount}</span> kayıt birleştirildi)
                </>
              ) : null}
              — tıklayınca tabloda tüm ilgili dersler vurgulanır.
            </p>
          )}
        </div>
      </div>

      {focusHint ? (
        <p className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[11px] font-medium text-amber-950 dark:text-amber-100">
          {focusHint}
        </p>
      ) : null}

      {!full && groups.length > 0 && (
        <ol className="max-h-[min(42vh,320px)] divide-y divide-border/40 overflow-y-auto overscroll-contain px-1 py-1">
          {groups.map((g) => {
            const highlightable = !!onSelectGroup && canHighlightGroup(g);
            const selected = activeGroupId === g.id;
            const RowTag = highlightable ? 'button' : 'div';
            return (
              <li key={g.id}>
                <RowTag
                  type={highlightable ? 'button' : undefined}
                  className={cn(
                    'group flex w-full gap-2.5 px-3 py-2 text-left transition-colors',
                    highlightable && 'cursor-pointer hover:bg-muted/40',
                    selected && 'bg-amber-500/15 ring-2 ring-inset ring-amber-500',
                  )}
                  onClick={highlightable ? () => onSelectGroup!(g) : undefined}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md',
                      selected
                        ? 'bg-amber-500 text-amber-950'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    )}
                    aria-hidden
                  >
                    {highlightable ? <Crosshair className="size-3.5" /> : <Minus className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{g.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{g.detail}</p>
                    {g.href ? (
                      <Link
                        href={g.href}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-[rgb(var(--dd-accent))] hover:underline"
                      >
                        Düzelt
                        <ArrowRight className="size-3" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 self-start">
                    {g.aside ? (
                      <span
                        className="max-w-[8.5rem] rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-center text-[10px] font-medium leading-snug text-foreground shadow-sm"
                        title={g.aside}
                      >
                        {g.aside}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-rose-800 dark:text-rose-200">
                      −{g.points}
                    </span>
                  </div>
                  {selected ? (
                    <ChevronDown className="mt-1 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  ) : highlightable ? (
                    <ChevronRight className="mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" aria-hidden />
                  ) : null}
                </RowTag>
              </li>
            );
          })}
        </ol>
      )}

      {!full && breakdown.deductions.length === 0 && (
        <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0" />
          Puan 100 değil; ayrıntılı kırılım kaydı yok (eski üretim). Yeniden oluşturun veya kuralları gözden geçirin.
        </p>
      )}
    </section>
  );
}
