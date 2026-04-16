'use client';

import { useMemo } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, PartyPopper, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StudentMascotIcon } from '../lib/student-mascot-icon';
import { EvalEmptyIllustration, EvalSparkleCluster } from './eval-decor';
import type { WeekStudentRow } from '../lib/eval-week-summary';

function pct(n: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}

function getWeekRowVisuals(
  r: WeekStudentRow,
  caps: { maxPos: number; maxNeg: number; maxCount: number; maxAct: number },
) {
  const idle = r.scoreCount === 0 && r.pos === 0 && r.neg === 0;
  const act = Math.abs(r.scoreSum) + r.scoreCount + r.pos + r.neg;
  return {
    idle,
    actPct: pct(act, caps.maxAct),
    posPct: pct(r.pos, caps.maxPos),
    negPct: pct(r.neg, caps.maxNeg),
    countPct: pct(r.scoreCount, caps.maxCount),
  };
}

export function HaftalikOzetPanel({
  weekLabel,
  weekOffset,
  onWeekOffset,
  rows,
  panelClass,
  headClass,
  iconWrapClass,
  iconClass,
}: {
  weekLabel: string;
  weekOffset: number;
  onWeekOffset: (delta: number) => void;
  rows: WeekStudentRow[];
  panelClass: string;
  headClass: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  const caps = useMemo(() => {
    let tp = 0;
    let tn = 0;
    let tsc = 0;
    let mp = 1;
    let mn = 1;
    let mc = 1;
    let ma = 1;
    let active = 0;
    for (const r of rows) {
      tp += r.pos;
      tn += r.neg;
      tsc += r.scoreCount;
      mp = Math.max(mp, r.pos);
      mn = Math.max(mn, r.neg);
      mc = Math.max(mc, r.scoreCount);
      const act = Math.abs(r.scoreSum) + r.scoreCount + r.pos + r.neg;
      ma = Math.max(ma, act);
      if (r.scoreCount > 0 || r.pos > 0 || r.neg > 0) active += 1;
    }
    return {
      maxPos: mp,
      maxNeg: mn,
      maxCount: mc,
      maxAct: ma,
      totals: { pos: tp, neg: tn, scoreCount: tsc },
      activeStudents: active,
    };
  }, [rows]);

  const { maxPos, maxNeg, maxCount, maxAct, totals, activeStudents } = caps;

  const summaryCards = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <div className="rounded-xl border border-emerald-300/40 bg-linear-to-b from-emerald-400/20 to-emerald-600/5 px-2 py-2 text-center shadow-sm sm:rounded-2xl sm:px-3 sm:py-3 dark:border-emerald-800/50 dark:from-emerald-500/15 dark:to-transparent">
        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 sm:text-[10px]">+ not</p>
        <p className="text-lg font-black tabular-nums leading-none text-emerald-700 dark:text-emerald-300 sm:text-2xl">{totals.pos}</p>
      </div>
      <div className="rounded-xl border border-rose-300/40 bg-linear-to-b from-rose-400/20 to-rose-600/5 px-2 py-2 text-center shadow-sm sm:rounded-2xl sm:px-3 sm:py-3 dark:border-rose-800/50 dark:from-rose-500/15 dark:to-transparent">
        <p className="text-[9px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-200 sm:text-[10px]">− not</p>
        <p className="text-lg font-black tabular-nums leading-none text-rose-700 dark:text-rose-300 sm:text-2xl">{totals.neg}</p>
      </div>
      <div className="rounded-xl border border-violet-300/40 bg-linear-to-b from-violet-400/20 to-violet-600/5 px-2 py-2 text-center shadow-sm sm:rounded-2xl sm:px-3 sm:py-3 dark:border-violet-800/50 dark:from-violet-500/15 dark:to-transparent">
        <p className="text-[9px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-200 sm:text-[10px]">Kriter kaydı</p>
        <p className="text-lg font-black tabular-nums leading-none text-violet-700 dark:text-violet-300 sm:text-2xl">{totals.scoreCount}</p>
      </div>
      <div className="rounded-xl border border-teal-300/40 bg-linear-to-b from-teal-400/15 to-teal-600/5 px-2 py-2 text-center shadow-sm sm:rounded-2xl sm:px-3 sm:py-3 dark:border-teal-800/50 dark:from-teal-500/12 dark:to-transparent">
        <p className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide text-teal-900 dark:text-teal-200 sm:text-[10px]">
          <Users className="size-3 shrink-0 opacity-80 sm:size-3.5" aria-hidden />
          Öğrenci
        </p>
        <p className="text-lg font-black tabular-nums leading-none text-teal-800 dark:text-teal-200 sm:text-2xl">{rows.length}</p>
      </div>
    </div>
  );

  return (
    <Card className={cn('relative overflow-hidden rounded-3xl border-2 shadow-md bg-card', panelClass)}>
      <EvalSparkleCluster className="pointer-events-none absolute right-3 top-14 size-10 opacity-80 sm:right-6 sm:top-16" />
      <CardHeader className={cn('relative z-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3', headClass)}>
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-2 ring-white/50 dark:ring-white/10 sm:size-11',
              iconWrapClass,
            )}
          >
            <BarChart3 className={cn('size-[1.15rem] shrink-0 sm:size-5', iconClass)} />
          </span>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight sm:text-lg">
              <PartyPopper className="size-4 shrink-0 text-teal-600 dark:text-teal-400 sm:size-5" aria-hidden />
              <span className="truncate">Haftalık özet</span>
            </CardTitle>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-sm">Pzt–Paz · kriter puanı ve +/- notlar</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1.5 sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" size="sm" className="size-9 shrink-0 rounded-xl p-0 sm:h-9 sm:px-3" onClick={() => onWeekOffset(-1)} aria-label="Önceki hafta">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-center text-[11px] font-bold tabular-nums text-foreground sm:min-w-48 sm:text-sm">{weekLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-9 shrink-0 rounded-xl p-0 sm:h-9 sm:px-3"
            onClick={() => onWeekOffset(1)}
            disabled={weekOffset >= 0}
            aria-label="Sonraki hafta"
          >
            <ChevronRight className="size-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button type="button" variant="ghost" size="sm" className="hidden rounded-xl text-xs sm:inline-flex" onClick={() => onWeekOffset(-weekOffset)}>
              Bu hafta
            </Button>
          )}
        </div>
        {weekOffset !== 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-8 w-full rounded-xl text-[11px] sm:hidden" onClick={() => onWeekOffset(-weekOffset)}>
            Bu haftaya dön
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <EvalEmptyIllustration className="w-44" />
            <p className="text-sm font-medium text-muted-foreground">Bu listede öğrenci yok.</p>
          </div>
        ) : (
          <>
            {/* Mobil */}
            <div className="space-y-2 px-2.5 pb-3 pt-1 sm:hidden">
              {summaryCards}
              <p className="px-0.5 text-center text-[10px] text-muted-foreground">
                <TrendingUp className="mr-0.5 inline size-3 align-text-bottom text-teal-600 opacity-80" aria-hidden />
                {activeStudents} / {rows.length} öğrencide hareket
              </p>
              <div className="space-y-2">
                {rows.map((r) => {
                  const v = getWeekRowVisuals(r, { maxPos, maxNeg, maxCount, maxAct });
                  return (
                    <div
                      key={r.studentId}
                      className={cn(
                        'overflow-hidden rounded-2xl border-2 p-2 shadow-sm',
                        v.idle
                          ? 'border-zinc-200/60 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40'
                          : 'border-teal-300/35 bg-linear-to-br from-teal-50/90 via-white to-cyan-50/40 dark:border-teal-800/40 dark:from-teal-950/35 dark:via-zinc-900 dark:to-violet-950/20',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10"
                          aria-hidden
                        >
                          <StudentMascotIcon studentId={r.studentId} className="size-9" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-[13px] font-bold leading-tight', v.idle && 'text-muted-foreground')}>{r.name}</p>
                          <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">∑ {r.scoreSum}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(
                              'inline-flex min-w-7 justify-end rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                              v.idle ? 'bg-muted text-muted-foreground' : 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
                            )}
                          >
                            {r.scoreCount}
                          </span>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">kayıt</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div>
                          <div className="mb-0.5 flex justify-between text-[9px] font-medium text-muted-foreground">
                            <span>Aktivite</span>
                            <span className="tabular-nums">{v.actPct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted/80 dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-linear-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${v.actPct}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">+</p>
                            <div className="h-1.5 overflow-hidden rounded-full bg-emerald-500/15 dark:bg-emerald-950/50">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${v.posPct}%` }} />
                            </div>
                            <p className="mt-0.5 text-center text-[10px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{r.pos}</p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-300">−</p>
                            <div className="h-1.5 overflow-hidden rounded-full bg-rose-500/15 dark:bg-rose-950/50">
                              <div className="h-full rounded-full bg-rose-500" style={{ width: `${v.negPct}%` }} />
                            </div>
                            <p className="mt-0.5 text-center text-[10px] font-bold tabular-nums text-rose-700 dark:text-rose-300">{r.neg}</p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">Kn</p>
                            <div className="h-1.5 overflow-hidden rounded-full bg-violet-500/15 dark:bg-violet-950/50">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${v.countPct}%` }} />
                            </div>
                            <p className="mt-0.5 text-center text-[10px] font-bold tabular-nums text-violet-700 dark:text-violet-300">{r.scoreCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Masaüstü / web */}
            <div className="hidden sm:block sm:space-y-4 sm:px-6 sm:pb-6 sm:pt-1">
              {summaryCards}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 shrink-0 text-teal-600 opacity-80" aria-hidden />
                <span>
                  Bu hafta <strong className="text-foreground">{activeStudents}</strong> / {rows.length} öğrencide kayıt veya not var
                </span>
              </p>
              <div className="overflow-hidden rounded-2xl border border-teal-200/40 shadow-sm dark:border-teal-900/40">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b-2 border-teal-200/50 bg-linear-to-r from-teal-500/12 via-cyan-500/8 to-violet-500/10 dark:border-teal-800/60 dark:from-teal-950/40 dark:via-zinc-900 dark:to-violet-950/30">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-teal-900 dark:text-teal-100">Öğrenci</th>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">∑ Puan</th>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Kayıt</th>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">+ not</th>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-rose-800 dark:text-rose-300">− not</th>
                        <th className="min-w-[140px] px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">Aktivite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const v = getWeekRowVisuals(r, { maxPos, maxNeg, maxCount, maxAct });
                        return (
                          <tr
                            key={r.studentId}
                            className={cn(
                              'border-b border-border/60 transition-colors hover:bg-teal-500/4 dark:hover:bg-teal-950/20',
                              idx % 2 === 1 && 'bg-muted/20',
                              v.idle && 'text-muted-foreground',
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2.5">
                                <span
                                  className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10"
                                  aria-hidden
                                >
                                  <StudentMascotIcon studentId={r.studentId} className="size-9" />
                                </span>
                                <span className="truncate font-semibold">{r.name}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold tabular-nums">{r.scoreSum}</td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              <span className={cn('inline-flex min-w-8 justify-center rounded-lg px-2 py-0.5 text-xs font-semibold', v.idle ? 'bg-muted/80' : 'bg-violet-500/12 text-violet-900 dark:text-violet-200')}>
                                {r.scoreCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{r.pos}</span>
                                <div className="h-1.5 w-full max-w-18 overflow-hidden rounded-full bg-emerald-500/15 dark:bg-emerald-950/40">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${v.posPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-300">{r.neg}</span>
                                <div className="h-1.5 w-full max-w-18 overflow-hidden rounded-full bg-rose-500/15 dark:bg-rose-950/40">
                                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${v.negPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/90 dark:bg-zinc-800">
                                  <div
                                    className="h-full rounded-full bg-linear-to-r from-teal-500 to-cyan-500 transition-all"
                                    style={{ width: `${v.actPct}%` }}
                                  />
                                </div>
                                <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted-foreground">{v.actPct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
