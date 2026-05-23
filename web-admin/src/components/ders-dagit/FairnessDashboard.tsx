'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CalendarDays, Scale, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type FairnessMetrics,
  type TeacherLoadStatus,
  LOAD_STATUS_LABEL,
  LOAD_STATUS_TONE,
  barColorForLessons,
  fairnessIndexTone,
} from '@/lib/ders-dagit-fairness';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';

function FairnessGauge({ index, size = 120 }: { index: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const dash = (index / 100) * c;
  const tone = fairnessIndexTone(index);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="fairnessGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.65 0.18 25)" />
            <stop offset="50%" stopColor="oklch(0.7 0.12 85)" />
            <stop offset="100%" stopColor="oklch(0.55 0.15 145)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted/40" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#fairnessGrad)"
          strokeWidth={8}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <Scale className={cn('mb-0.5 h-4 w-4', tone)} aria-hidden />
        <span className={cn('text-2xl font-bold tabular-nums', tone)}>{index}</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Adalet</span>
      </span>
    </div>
  );
}

function WeekBalanceDonut({ monFriPct }: { monFriPct: number }) {
  const other = Math.max(0, 100 - monFriPct);
  const heavy = monFriPct > 40;
  return (
    <div className="flex items-center gap-4">
      <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0" aria-hidden>
        <circle cx="36" cy="36" r="28" fill="none" className="stroke-muted/30" strokeWidth="10" />
        <circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          className={heavy ? 'stroke-amber-500' : 'stroke-violet-500'}
          strokeWidth="10"
          strokeDasharray={`${(monFriPct / 100) * 175.9} 175.9`}
          transform="rotate(-90 36 36)"
          strokeLinecap="round"
        />
        <text x="36" y="38" textAnchor="middle" className="fill-foreground text-[11px] font-bold">
          %{monFriPct}
        </text>
      </svg>
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Pzt + Cum</p>
        <p>Sal–Per: %{other}</p>
        {heavy && <p className="mt-1 text-amber-700 dark:text-amber-300">Kenar gün yoğun</p>}
      </div>
    </div>
  );
}

const FILTER_OPTIONS: Array<{ id: 'all' | TeacherLoadStatus; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'balanced', label: 'Dengeli' },
  { id: 'high', label: 'Yoğun' },
  { id: 'low', label: 'Hafif' },
];

export function FairnessDashboard({ data }: { data: FairnessMetrics }) {
  const [filter, setFilter] = useState<'all' | TeacherLoadStatus>('all');
  const [anon, setAnon] = useState(false);

  const stats = data.teacher_stats ?? [];
  const avg = data.avg_lessons_per_teacher ?? 0;
  const min = data.min_lessons_per_teacher ?? 0;
  const max = data.max_lessons_per_teacher ?? 0;
  const index = data.fairness_index ?? 0;

  const filtered = useMemo(() => {
    const list = stats.filter((t) => filter === 'all' || t.load_status === filter);
    return [...list].sort((a, b) => b.lesson_count - a.lesson_count);
  }, [stats, filter]);

  const chartData = useMemo(
    () =>
      filtered.slice(0, 24).map((t) => ({
        name: anon ? `Öğr. ${t.teacher_id.slice(0, 4)}` : (t.label ?? '—'),
        count: t.lesson_count,
        gaps: t.gap_count,
      })),
    [filtered, anon],
  );

  const byStatus = useMemo(() => {
    const m = { low: 0, balanced: 0, high: 0 };
    for (const t of stats) {
      const s = t.load_status ?? 'balanced';
      m[s]++;
    }
    return m;
  }, [stats]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-500/10 via-background to-indigo-500/5 p-5 dark:border-violet-800/40">
        <svg className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 opacity-20" viewBox="0 0 120 120" aria-hidden>
          <path d="M60 8 L72 44 L108 44 L78 66 L90 102 L60 80 L30 102 L42 66 L12 44 L48 44 Z" fill="currentColor" className="text-violet-500" />
        </svg>
        <div className="relative flex flex-wrap items-start gap-6">
          <FairnessGauge index={index} />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-lg font-semibold tracking-tight">Öğretmen yükü ve adalet</h1>
            <p className="text-sm text-muted-foreground">
              {data.program_name ?? 'Program'} ·{' '}
              <span className="capitalize">{data.program_status ?? '—'}</span> — idare özeti
            </p>
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                index >= 80 && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                index >= 55 && index < 80 && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                index < 55 && 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
              )}
            >
              {data.distribution_label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAnon((v) => !v)}>
              {anon ? 'İsimleri göster' : 'Anonim görünüm'}
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href="/ders-dagit/studyo/program">Programa git</Link>
            </Button>
          </div>
        </div>
      </div>

      {data.hint && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {data.hint}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ortalama saat', value: avg, icon: Users, tone: 'text-violet-600 bg-violet-500/10' },
          { label: 'En az – en çok', value: `${min} – ${max}`, icon: Scale, tone: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Toplam boşluk', value: data.total_gaps ?? 0, icon: CalendarDays, tone: 'text-amber-600 bg-amber-500/10' },
          { label: 'Öğretmen', value: data.teacher_count ?? 0, icon: Users, tone: 'text-sky-600 bg-sky-500/10' },
        ].map((k) => (
          <DdCard key={k.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', k.tone)}>
                <k.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tabular-nums">{k.value}</p>
              </div>
            </CardContent>
          </DdCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DdCard className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Haftalık ders dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {FILTER_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFilter(o.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    filter === o.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {o.label}
                  {o.id !== 'all' && (
                    <span className="ml-1 opacity-70">({byStatus[o.id as TeacherLoadStatus]})</span>
                  )}
                </button>
              ))}
            </div>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Bu filtrede öğretmen yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, name: string) => [v, name === 'gaps' ? 'Boşluk' : 'Ders saati']}
                  />
                  <ReferenceLine x={avg} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: 'Ort.', position: 'top', fontSize: 10 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((row, i) => (
                      <Cell key={i} fill={barColorForLessons(row.count, min, max)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </DdCard>

        <DdCard>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hafta dengesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeekBalanceDonut monFriPct={data.monday_friday_slot_ratio ?? 0} />
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs font-medium text-muted-foreground">Yük durumu</p>
              {(['low', 'balanced', 'high'] as const).map((s) => (
                <div key={s} className="flex items-center justify-between text-sm">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs ring-1 ring-inset', LOAD_STATUS_TONE[s])}>
                    {LOAD_STATUS_LABEL[s]}
                  </span>
                  <span className="font-semibold tabular-nums">{byStatus[s]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </DdCard>
      </div>

      <DdCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Öğretmen kartları</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => {
              const status = t.load_status ?? 'balanced';
              const pct = max > 0 ? Math.round((t.lesson_count / max) * 100) : 0;
              return (
                <li
                  key={t.teacher_id}
                  className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {anon ? `Öğretmen …${t.teacher_id.slice(0, 4)}` : (t.label ?? '—')}
                      </p>
                      {t.branch && <p className="truncate text-[10px] text-muted-foreground">{t.branch}</p>}
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset', LOAD_STATUS_TONE[status])}>
                      {LOAD_STATUS_LABEL[status]}
                    </span>
                  </div>
                  <div className="mb-1 flex justify-between text-xs tabular-nums">
                    <span>{t.lesson_count} saat</span>
                    <span className={t.deviation_from_avg > 0 ? 'text-rose-600' : t.deviation_from_avg < 0 ? 'text-sky-600' : 'text-muted-foreground'}>
                      {t.deviation_from_avg > 0 ? '+' : ''}
                      {t.deviation_from_avg}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        status === 'high' && 'bg-rose-500/80',
                        status === 'low' && 'bg-sky-500/80',
                        status === 'balanced' && 'bg-emerald-500/80',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>{t.work_day_count} gün</span>
                    <span>·</span>
                    <span className={t.gap_heavy ? 'font-medium text-amber-700 dark:text-amber-300' : undefined}>
                      {t.gap_count} boşluk
                    </span>
                    {t.mandatory_weekly_hours != null && (
                      <>
                        <span>·</span>
                        <span>Zorunlu {t.mandatory_weekly_hours}s</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </DdCard>
    </div>
  );
}
