'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Minus } from 'lucide-react';
import type { ProgramScoreBreakdown } from '@/lib/ders-dagit-score-breakdown';
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
}: {
  breakdown: ProgramScoreBreakdown;
  title?: string;
  className?: string;
}) {
  const full = breakdown.points_to_full <= 0;

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
              <strong className="text-foreground tabular-nums">{breakdown.points_to_full}</strong> puan eksik; 100 için
              aşağıdaki maddeleri giderin.
            </p>
          )}
        </div>
      </div>

      {!full && breakdown.deductions.length > 0 && (
        <ol className="divide-y divide-border/40 px-1 py-1">
          {breakdown.deductions.map((d) => (
            <li key={d.id} className="group flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30">
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300"
                aria-hidden
              >
                <Minus className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{d.title}</p>
                  <span className="shrink-0 rounded-full bg-rose-500/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-800 dark:text-rose-200">
                    −{d.points}
                  </span>
                </div>
                {d.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{d.subtitle}</p>}
                {d.href && (
                  <Link
                    href={d.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--dd-accent))] hover:underline"
                  >
                    Düzelt
                    <ArrowRight className="size-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </li>
          ))}
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
