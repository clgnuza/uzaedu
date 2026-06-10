'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatAcademicWeekHeading, type WeekWithItems } from './academic-calendar-timeline';
import {
  CalendarDays,
  CalendarRange,
  LayoutList,
  Sparkles,
  UserCheck,
  BarChart3,
  Pin,
} from 'lucide-react';

type Progress = {
  elapsedPct: number;
  weekRange: string;
  weekOfYear: number;
};

function countMyTasks(weeks: WeekWithItems[], userId?: string | null) {
  if (!userId) return { total: 0, thisWeek: 0 };
  let total = 0;
  let thisWeek = 0;
  const now = new Date();
  for (const w of weeks) {
    const items = [...(w.belirliGunHafta ?? []), ...(w.ogretmenIsleri ?? [])];
    const mine = items.filter((i) => (i.assignedUsers ?? []).some((a) => a.userId === userId)).length;
    total += mine;
    if (w.dateStart && w.dateEnd) {
      const start = new Date(`${w.dateStart}T00:00:00`);
      const end = new Date(`${w.dateEnd}T23:59:59`);
      if (now >= start && now <= end) thisWeek += mine;
    }
  }
  return { total, thisWeek };
}

export function TeacherAcademicCalendarChrome({
  academicYear,
  academicYears,
  onAcademicYearChange,
  viewMode,
  onViewModeChange,
  progress,
  currentWeekOrder,
  currentWeekData,
  weeks,
  userId,
  schoolName,
}: {
  academicYear: string;
  academicYears: string[];
  onAcademicYearChange: (y: string) => void;
  viewMode: 'week' | 'month';
  onViewModeChange: (v: 'week' | 'month') => void;
  progress: Progress;
  currentWeekOrder: number;
  currentWeekData?: WeekWithItems;
  weeks: WeekWithItems[];
  userId?: string | null;
  schoolName?: string | null;
}) {
  const etkinlik = (currentWeekData?.belirliGunHafta?.length ?? 0) + (currentWeekData?.ogretmenIsleri?.length ?? 0);
  const myTasks = useMemo(() => countMyTasks(weeks, userId), [weeks, userId]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-fuchsia-600 to-amber-500 px-4 py-4 shadow-lg sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-12 left-1/4 size-32 rounded-full bg-amber-300/25 blur-2xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <CalendarDays className="size-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Akademik takvim</h1>
              <p className="mt-0.5 truncate text-xs text-white/85 sm:text-sm">
                {schoolName ? `${schoolName} · ` : ''}
                {academicYear} öğretim yılı
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={academicYear}
              onChange={(e) => onAcademicYearChange(e.target.value)}
              className="h-9 rounded-xl border border-white/30 bg-white/15 px-3 text-xs font-semibold text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/35 sm:text-sm"
              aria-label="Öğretim yılı"
            >
              {academicYears.map((y) => (
                <option key={y} value={y} className="text-foreground">
                  {y}
                </option>
              ))}
            </select>
            <div className="flex rounded-xl border border-white/30 bg-white/10 p-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange('week')}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:text-xs',
                  viewMode === 'week' ? 'bg-white text-violet-700' : 'text-white/85 hover:text-white',
                )}
                aria-pressed={viewMode === 'week'}
              >
                <CalendarRange className="size-3.5" />
                Hafta
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('month')}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:text-xs',
                  viewMode === 'month' ? 'bg-white text-violet-700' : 'text-white/85 hover:text-white',
                )}
                aria-pressed={viewMode === 'month'}
              >
                <LayoutList className="size-3.5" />
                Liste
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            label: 'Bu hafta',
            value: currentWeekData
              ? formatAcademicWeekHeading(currentWeekData)
              : currentWeekOrder > 0
                ? `${currentWeekOrder}. hafta`
                : '—',
            sub: progress.weekRange,
            icon: Pin,
            cls: 'from-indigo-500/12 to-violet-500/8 text-indigo-800 dark:text-indigo-200',
            iconCls: 'text-indigo-600',
          },
          {
            label: 'Etkinlik',
            value: String(etkinlik),
            sub: 'bu haftada',
            icon: Sparkles,
            cls: 'from-amber-500/12 to-orange-500/8 text-amber-900 dark:text-amber-100',
            iconCls: 'text-amber-600',
          },
          {
            label: 'Göreviniz',
            value: String(myTasks.thisWeek),
            sub: myTasks.total > myTasks.thisWeek ? `yılda ${myTasks.total}` : 'bu hafta',
            icon: UserCheck,
            cls: 'from-fuchsia-500/12 to-pink-500/8 text-fuchsia-900 dark:text-fuchsia-100',
            iconCls: 'text-fuchsia-600',
          },
          {
            label: 'Yıl',
            value: `%${progress.elapsedPct.toFixed(0)}`,
            sub: 'tamamlandı',
            icon: BarChart3,
            cls: 'from-teal-500/12 to-cyan-500/8 text-teal-900 dark:text-teal-100',
            iconCls: 'text-teal-600',
          },
        ].map((k) => (
          <div
            key={k.label}
            className={cn('rounded-xl border border-border/50 bg-linear-to-br px-3 py-2.5 shadow-xs', k.cls)}
          >
            <div className="flex items-center gap-1.5">
              <k.icon className={cn('size-3.5 shrink-0', k.iconCls)} aria-hidden />
              <p className="text-[9px] font-bold uppercase tracking-wide opacity-80">{k.label}</p>
            </div>
            <p className="mt-1 text-base font-black tabular-nums leading-none sm:text-lg">{k.value}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-xs">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground sm:text-xs">
          <span>Öğretim yılı ilerlemesi</span>
          <span className="tabular-nums">%{progress.elapsedPct.toFixed(1)}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted sm:h-3">
          <div
            className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-[width] duration-500"
            style={{ width: `${progress.elapsedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
