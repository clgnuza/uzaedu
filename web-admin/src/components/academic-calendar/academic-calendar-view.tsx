'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useId, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ClipboardList,
  CalendarRange,
  LayoutGrid,
  CalendarDays,
  LayoutList,
  Users,
  UserCheck,
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { AssignedUserView, WeekWithItems } from './academic-calendar-timeline';
import { BelirliPill, OgretmenPill } from './academic-calendar-timeline';
import { cn } from '@/lib/utils';
import { BILSEM_VIEW_TAB_STYLES } from '@/lib/bilsem-takvim-ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Kart köşelerinde hafif pastel dekor (benzersiz gradient id) */
function CardPastelMesh({ variant, className }: { variant: 'header' | 'amber' | 'sky'; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const g1 = `mesh-${variant}-a-${uid}`;
  const g2 = `mesh-${variant}-b-${uid}`;
  const stops =
    variant === 'amber'
      ? (
          <>
            <stop offset="0%" stopColor="rgb(254 243 199 / 0.45)" />
            <stop offset="100%" stopColor="rgb(254 215 170 / 0.25)" />
          </>
        )
      : variant === 'sky'
        ? (
            <>
              <stop offset="0%" stopColor="rgb(224 242 254 / 0.5)" />
              <stop offset="100%" stopColor="rgb(186 230 253 / 0.3)" />
            </>
          )
        : (
            <>
              <stop offset="0%" stopColor="rgb(237 233 254 / 0.5)" />
              <stop offset="100%" stopColor="rgb(243 232 255 / 0.35)" />
            </>
          );
  return (
    <svg className={cn('pointer-events-none absolute inset-0 h-full w-full select-none', className)} viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          {stops}
        </linearGradient>
        <linearGradient id={g2} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(255 255 255 / 0.6)" />
          <stop offset="100%" stopColor="rgb(255 255 255 / 0)" />
        </linearGradient>
      </defs>
      <path fill={`url(#${g1})`} d="M0,0 C120,60 280,0 400,40 L400,200 L0,200 Z" opacity="0.9" />
      <circle cx="340" cy="48" r="72" fill={`url(#${g2})`} opacity="0.5" />
    </svg>
  );
}

interface AcademicCalendarViewProps {
  weeks: WeekWithItems[];
  defaultDate?: Date;
  view?: 'week' | 'month';
  onViewChange?: (view: 'week' | 'month') => void;
  className?: string;
  currentUserId?: string | null;
  /** Öğretmen / mobil: daha sıkı boşluk ve üst çubuk */
  compact?: boolean;
}

/** Tek satır görevlendirme; yalnızca kişi varsa kullanın */
function GorevlendirmeInline({ users, tone }: { users: AssignedUserView[]; tone: 'orange' | 'sky' }) {
  const sorumlu = users.filter((u) => u.gorevTipi === 'sorumlu');
  const yardimci = users.filter((u) => u.gorevTipi === 'yardimci');
  const names = (arr: AssignedUserView[]) => arr.map((u) => u.displayName?.trim() || '—').join(', ');
  const bits: string[] = [];
  if (sorumlu.length) bits.push(`Sorumlu: ${names(sorumlu)}`);
  if (yardimci.length) bits.push(`Yard.: ${names(yardimci)}`);
  if (bits.length === 0) return null;
  return (
    <span
      className={cn(
        'text-[11px] leading-tight sm:text-xs',
        tone === 'orange'
          ? 'text-orange-950/90 dark:text-orange-100/95'
          : 'text-sky-950/90 dark:text-sky-100/95'
      )}
    >
      {bits.join(' · ')}
    </span>
  );
}

function formatCompactGorev(users: AssignedUserView[]): string {
  if (users.length === 0) return '';
  return users
    .map((u) => {
      const n = u.displayName?.trim() || '—';
      const tag = u.gorevTipi === 'sorumlu' ? 'sor.' : 'yard.';
      return `${n} (${tag})`;
    })
    .join(' · ');
}

function formatWeekOptionDates(startStr: string, endStr: string): string {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const a = format(start, 'd MMM', { locale: tr });
  const b = format(end, 'd MMM', { locale: tr });
  return `${a} – ${b}`;
}

function formatDateRangeProminent(startStr: string, endStr: string): string {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const monthName = format(start, 'MMMM', { locale: tr }).toUpperCase();
  const year = format(start, 'yyyy', { locale: tr });
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${monthName} ${year}`;
  }
  const monthEnd = format(end, 'MMMM', { locale: tr }).toUpperCase();
  return `${start.getDate()} ${monthName} – ${end.getDate()} ${monthEnd} ${year}`;
}

function WeekDaysRow({ dateStart, dateEnd, isMain = false }: { dateStart: string; dateEnd: string; isMain?: boolean }) {
  const rangeStart = startOfDay(parseISO(dateStart));
  const rangeEnd = startOfDay(parseISO(dateEnd));
  const days: { date: Date; label: string; gun: string; isToday: boolean }[] = [];
  const today = new Date();
  for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
    const dayOfWeek = d.getDay();
    const gun = GUNLER[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    days.push({
      date: new Date(d),
      label: format(d, 'd', { locale: tr }),
      gun,
      isToday: format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
    });
  }

  const sameMonth =
    rangeStart.getMonth() === rangeEnd.getMonth() && rangeStart.getFullYear() === rangeEnd.getFullYear();
  const monthLabel = sameMonth
    ? format(rangeStart, 'MMMM', { locale: tr })
    : `${format(rangeStart, 'MMMM', { locale: tr })} – ${format(rangeEnd, 'MMMM', { locale: tr })}`;
  const year = format(rangeStart, 'yyyy', { locale: tr });
  const dayRangeText = sameMonth
    ? `${rangeStart.getDate()}–${rangeEnd.getDate()}. gün`
    : `${format(rangeStart, 'd MMM', { locale: tr })} – ${format(rangeEnd, 'd MMM yyyy', { locale: tr })}`;
  const n = Math.max(1, days.length);

  return (
    <div className="space-y-1.5 sm:space-y-3 md:space-y-2">
      <div className="sm:hidden">
        <div className="flex items-center gap-2 rounded-lg border border-indigo-100/50 bg-white/60 px-2 py-1.5 dark:border-indigo-900/40 dark:bg-indigo-950/30">
          <CalendarRange className="size-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2} aria-hidden />
          <p className="min-w-0 text-left text-[11px] font-medium leading-tight text-foreground">
            <span className="capitalize">{monthLabel}</span>{' '}
            <span className="font-normal text-muted-foreground">{year}</span>
            <span className="block text-[10px] font-normal text-muted-foreground">{dayRangeText}</span>
          </p>
        </div>
      </div>
      <div className="hidden flex-col items-center gap-2 text-center sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:text-left md:gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100/90 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 sm:size-9 sm:rounded-xl">
            <CalendarRange className="size-3.5 sm:size-[1.125rem]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 sm:text-left">
            <p className={cn('font-semibold capitalize tracking-tight text-foreground', isMain ? 'text-sm sm:text-xl md:text-lg lg:text-xl' : 'text-sm sm:text-base md:text-sm')}>
              {monthLabel}{' '}
              <span className="font-normal text-muted-foreground">{year}</span>
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm md:text-xs">{dayRangeText}</p>
          </div>
        </div>
      </div>
      <div className="-mx-0.5 flex justify-stretch overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] max-sm:px-0 sm:mx-0 sm:justify-start sm:overflow-visible sm:pb-1">
        <div
          className="grid w-full min-w-0 gap-0.5 rounded-lg border border-indigo-100/45 bg-gradient-to-b from-indigo-50/45 to-cyan-50/15 p-0.5 dark:border-indigo-900/35 dark:from-indigo-950/30 dark:to-slate-950/40 sm:rounded-xl sm:gap-1.5 sm:p-2 md:gap-1 md:p-1.5"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                'flex min-h-9 flex-col items-center justify-center rounded border py-0.5 transition-colors sm:min-h-14 sm:min-w-11 sm:rounded-lg sm:py-1.5 md:min-h-10 md:min-w-9 md:py-1',
                day.isToday
                  ? 'border-indigo-400/60 bg-indigo-50 shadow-sm ring-2 ring-indigo-400/25 dark:border-indigo-500/50 dark:bg-indigo-950/55 dark:ring-indigo-500/20'
                  : 'border-white/50 bg-white/60 dark:border-white/5 dark:bg-white/5'
              )}
            >
              <span className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">{day.gun}</span>
              <span
                className={cn(
                  'mt-0.5 text-[11px] font-bold tabular-nums sm:text-base md:text-sm',
                  day.isToday ? 'text-indigo-700 dark:text-indigo-200' : 'text-foreground'
                )}
              >
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekCardMain({
  week,
  currentUserId,
}: {
  week: WeekWithItems;
  currentUserId?: string | null;
}) {
  const belirli = week.belirliGunHafta?.length ?? 0;
  const ogretmen = week.ogretmenIsleri?.length ?? 0;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-indigo-100/40 bg-card shadow-sm ring-1 ring-indigo-100/15 dark:border-indigo-900/35 dark:ring-indigo-900/25 md:rounded-2xl md:border-violet-100/50 md:shadow-sm md:ring-violet-100/30 md:dark:border-violet-900/25 md:dark:ring-violet-900/20">
      <div className="relative overflow-hidden border-b border-indigo-100/35 bg-gradient-to-br from-indigo-50/45 via-background to-cyan-50/20 px-2 py-2 dark:border-indigo-900/30 dark:from-indigo-950/25 dark:via-background dark:to-slate-950/40 max-sm:py-2 sm:border-violet-100/40 sm:from-violet-50/50 sm:to-sky-50/30 sm:px-5 sm:py-5 sm:dark:border-violet-900/30 sm:dark:from-violet-950/30 md:px-4 md:py-3">
        <CardPastelMesh variant="header" className="opacity-90 dark:opacity-60" />
        <div className="relative z-[1]">
          {week.dateStart && week.dateEnd ? (
            <WeekDaysRow dateStart={week.dateStart} dateEnd={week.dateEnd} isMain />
          ) : (
            <p className="text-center text-muted-foreground">{week.title ?? 'Tarih yok'}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5 p-2 sm:space-y-3 sm:p-4 md:space-y-2 md:p-3">
        {belirli > 0 || ogretmen > 0 ? (
          <>
            {belirli > 0 && (
              <section
                className="relative overflow-hidden rounded-lg border border-amber-200/45 bg-gradient-to-br from-amber-50/85 to-rose-50/25 p-2.5 dark:border-amber-900/35 dark:from-amber-950/30 dark:to-rose-950/15 sm:rounded-xl sm:border-orange-200/50 sm:from-orange-50/80 sm:to-amber-50/30 sm:p-3 sm:dark:border-orange-900/30 sm:dark:from-orange-950/35 sm:dark:to-amber-950/20 md:p-2"
                aria-labelledby="belirli-heading"
              >
                <CardPastelMesh variant="amber" className="opacity-50 dark:opacity-40" />
                <div className="relative z-[1]">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-2.5 sm:gap-2 md:mb-1.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-amber-100/95 text-amber-700 dark:bg-amber-950/55 dark:text-amber-300 sm:size-8 sm:rounded-lg sm:bg-orange-100/90 sm:text-orange-600 sm:dark:bg-orange-950/60 sm:dark:text-orange-300 md:size-7">
                      <Sparkles className="size-3.5 sm:size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 id="belirli-heading" className="text-xs font-semibold text-amber-950 dark:text-amber-50 sm:text-sm sm:text-orange-950 sm:dark:text-orange-50">
                        Belirli gün ve haftalar
                      </h3>
                    </div>
                    <span className="rounded-md bg-orange-200/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-orange-900 dark:bg-orange-900/40 dark:text-orange-100">
                      {belirli}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-1.5">
                    {week.belirliGunHafta?.map((item) => {
                      const assigned = item.assignedUsers ?? [];
                      const isMyTask = !!(currentUserId && assigned.some((a) => a.userId === currentUserId));
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-orange-200/40 bg-white/70 py-2 pl-2.5 pr-2 dark:border-orange-900/35 dark:bg-orange-950/20 md:py-1.5 md:pl-2 md:pr-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
                            <BelirliPill
                              title={item.title}
                              path={item.path}
                              className="max-w-[min(100%,28rem)] border-orange-200/50 bg-orange-50/80 py-1 text-xs dark:border-orange-800/40 dark:bg-orange-950/30 dark:text-orange-100"
                            />
                            {isMyTask && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-900/45 dark:text-violet-100">
                                <UserCheck className="size-3 shrink-0" aria-hidden />
                                Sizin
                              </span>
                            )}
                          </div>
                          {assigned.length > 0 && (
                            <div className="mt-1.5 flex items-start gap-1.5 border-t border-orange-100/80 pt-1.5 dark:border-orange-900/30">
                              <Users className="mt-0.5 size-3 shrink-0 text-orange-500/80 dark:text-orange-400/80" aria-hidden />
                              <GorevlendirmeInline users={assigned} tone="orange" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
            {ogretmen > 0 && (
              <section
                className="relative overflow-hidden rounded-lg border border-cyan-200/45 bg-gradient-to-br from-cyan-50/80 to-sky-50/30 p-2.5 dark:border-cyan-900/35 dark:from-cyan-950/30 dark:to-sky-950/20 sm:rounded-xl sm:border-sky-200/50 sm:from-sky-50/80 sm:to-blue-50/25 sm:p-3 sm:dark:border-sky-900/30 sm:dark:from-sky-950/35 sm:dark:to-blue-950/20 md:p-2"
                aria-labelledby="ogretmen-heading"
              >
                <CardPastelMesh variant="sky" className="opacity-50 dark:opacity-40" />
                <div className="relative z-[1]">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-2.5 sm:gap-2 md:mb-1.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-cyan-100/95 text-cyan-700 dark:bg-cyan-950/55 dark:text-cyan-300 sm:size-8 sm:rounded-lg sm:bg-sky-100/90 sm:text-sky-600 sm:dark:bg-sky-950/60 sm:dark:text-sky-300 md:size-7">
                      <ClipboardList className="size-3.5 sm:size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 id="ogretmen-heading" className="text-xs font-semibold text-cyan-950 dark:text-cyan-50 sm:text-sm sm:text-sky-950 sm:dark:text-sky-50">
                        Öğretmen işleri
                      </h3>
                    </div>
                    <span className="rounded-md bg-sky-200/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                      {ogretmen}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-1.5">
                    {week.ogretmenIsleri?.map((item) => {
                      const assigned = item.assignedUsers ?? [];
                      const isMyTask = !!(currentUserId && assigned.some((a) => a.userId === currentUserId));
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-sky-200/40 bg-white/70 py-2 pl-2.5 pr-2 dark:border-sky-900/35 dark:bg-sky-950/20 md:py-1.5 md:pl-2 md:pr-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
                            <OgretmenPill
                              title={item.title}
                              path={item.path}
                              className="max-w-[min(100%,28rem)] border-sky-200/50 bg-sky-50/80 py-1 text-xs dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-100"
                            />
                            {isMyTask && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-900/45 dark:text-violet-100">
                                <UserCheck className="size-3 shrink-0" aria-hidden />
                                Sizin
                              </span>
                            )}
                          </div>
                          {assigned.length > 0 && (
                            <div className="mt-1.5 flex items-start gap-1.5 border-t border-sky-100/80 pt-1.5 dark:border-sky-900/30">
                              <Users className="mt-0.5 size-3 shrink-0 text-sky-500/80 dark:text-sky-400/80" aria-hidden />
                              <GorevlendirmeInline users={assigned} tone="sky" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-indigo-200/50 bg-indigo-50/25 py-8 dark:border-indigo-900/45 dark:bg-indigo-950/20 sm:gap-3 sm:rounded-2xl sm:border-violet-200/60 sm:bg-violet-50/30 sm:py-10 sm:dark:border-violet-900/40 sm:dark:bg-violet-950/20 md:py-6">
            <svg className="size-10 text-indigo-300 dark:text-indigo-700 sm:size-12 sm:text-violet-300 sm:dark:text-violet-700" viewBox="0 0 48 48" fill="none" aria-hidden>
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
              <path d="M16 22h16M16 26h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            </svg>
            <p className="px-4 text-center text-sm text-muted-foreground">Bu hafta için kayıtlı etkinlik yok.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekCardCompact({
  week,
  isActive,
  onClick,
  currentUserId,
}: {
  week: WeekWithItems;
  isActive: boolean;
  onClick?: () => void;
  currentUserId?: string | null;
}) {
  const isCurrentWeek =
    week.dateStart &&
    week.dateEnd &&
    isWithinInterval(new Date(), {
      start: startOfDay(parseISO(week.dateStart)),
      end: endOfDay(parseISO(week.dateEnd)),
    });
  const belirli = week.belirliGunHafta?.length ?? 0;
  const ogretmen = week.ogretmenIsleri?.length ?? 0;
  const total = belirli + ogretmen;
  const hasMyTaskInWeek =
    !!currentUserId &&
    [...(week.belirliGunHafta ?? []), ...(week.ogretmenIsleri ?? [])].some((i) =>
      (i.assignedUsers ?? []).some((a) => a.userId === currentUserId)
    );
  const Wrapper = onClick ? 'button' : 'div';
  const props = onClick ? { type: 'button' as const, onClick } : {};

  return (
    <Wrapper
      {...props}
      className={cn(
        'group flex min-h-0 w-full flex-col overflow-hidden rounded-lg border text-left transition-all duration-200 active:scale-[0.99] md:rounded-xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/45 focus-visible:ring-offset-2 sm:focus-visible:ring-violet-400/50',
        isActive
          ? 'border-indigo-300/80 bg-gradient-to-b from-indigo-50/90 to-card shadow-md ring-2 ring-indigo-300/25 dark:border-indigo-600/50 dark:from-indigo-950/45 sm:border-violet-300/70 sm:from-violet-50/90 sm:ring-violet-300/30 sm:dark:border-violet-700/50 sm:dark:from-violet-950/50'
          : 'border-indigo-100/85 bg-card hover:border-indigo-200/90 hover:shadow-md dark:border-indigo-900/45 sm:border-violet-100/80 sm:hover:border-violet-200 sm:dark:border-violet-900/40'
      )}
    >
      <div className="relative flex items-start justify-between gap-2 overflow-hidden border-b border-indigo-100/50 bg-gradient-to-r from-indigo-50/55 to-teal-50/25 px-2.5 py-2 dark:border-indigo-900/35 dark:from-indigo-950/40 dark:to-teal-950/15 sm:border-violet-100/50 sm:from-violet-50/60 sm:to-sky-50/35 sm:px-3 sm:py-2.5 sm:dark:border-violet-900/30 sm:dark:from-violet-950/40 sm:dark:to-sky-950/20 md:py-1.5 md:leading-tight">
        <svg className="pointer-events-none absolute -end-2 -top-4 size-14 text-indigo-200/45 dark:text-indigo-900/30 sm:size-16 sm:text-violet-200/40 sm:dark:text-violet-800/25" viewBox="0 0 96 96" fill="none" aria-hidden>
          <circle cx="72" cy="24" r="40" fill="currentColor" opacity="0.35" />
        </svg>
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold tabular-nums sm:text-lg md:text-base">{week.weekNumber}. hafta</span>
            {isCurrentWeek && (
              <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                Bu hafta
              </span>
            )}
          </div>
          {week.dateStart && week.dateEnd && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{formatDateRangeProminent(week.dateStart, week.dateEnd)}</p>
          )}
        </div>
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-white/85 text-indigo-500 dark:bg-indigo-950/45 dark:text-indigo-300 sm:size-8 sm:rounded-lg sm:text-violet-500 sm:dark:bg-violet-950/50 sm:dark:text-violet-300">
          <LayoutGrid className="size-3.5 sm:size-4" strokeWidth={2} aria-hidden />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3 md:gap-1.5 md:p-2">
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-100/80 px-2 py-1 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100">
            <Sparkles className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            Belirli {belirli}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-100/80 px-2 py-1 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
            <ClipboardList className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            İş {ogretmen}
          </span>
          {total === 0 && <span className="text-muted-foreground">Kayıt yok</span>}
        </div>
        {total > 0 && (
          <div className="flex flex-col gap-1.5 text-left">
            {hasMyTaskInWeek && (
              <p className="rounded-md bg-violet-100/80 px-2 py-0.5 text-center text-[10px] font-medium text-violet-900 dark:bg-violet-900/35 dark:text-violet-100">
                Size atanan görev bu hafta
              </p>
            )}
            {(week.belirliGunHafta ?? []).slice(0, 2).map((i) => {
              const au = i.assignedUsers ?? [];
              const my = !!(currentUserId && au.some((a) => a.userId === currentUserId));
              return (
                <div key={i.id} className="border-l-2 border-orange-400/70 pl-2 dark:border-orange-600/60">
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">{i.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {my && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">
                        <UserCheck className="size-2.5 shrink-0" aria-hidden />
                        Sizin
                      </span>
                    )}
                    {au.length > 0 && (
                      <span className="text-[10px] leading-tight text-muted-foreground">{formatCompactGorev(au)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {(week.belirliGunHafta ?? []).length > 2 && (
              <p className="text-[10px] text-muted-foreground">+{(week.belirliGunHafta ?? []).length - 2} belirli…</p>
            )}
            {(week.ogretmenIsleri ?? []).length > 0 && (
              <div className="border-l-2 border-sky-400/60 pl-2 dark:border-sky-600/50">
                <p className="text-[9px] font-medium uppercase tracking-wide text-sky-800 dark:text-sky-300">Öğretmen işleri</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-foreground">
                  {(week.ogretmenIsleri ?? []).map((i) => i.title).slice(0, 4).join(' · ')}
                  {(week.ogretmenIsleri ?? []).length > 4 ? '…' : ''}
                </p>
              </div>
            )}
          </div>
        )}
        <span className="mt-1 text-[10px] font-medium text-violet-600/90 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 dark:text-violet-400">
          Detay →
        </span>
      </div>
    </Wrapper>
  );
}

export function AcademicCalendarView({
  weeks,
  defaultDate,
  view = 'week',
  onViewChange,
  className,
  currentUserId,
  compact = false,
}: AcademicCalendarViewProps) {
  const initialWeekIndex = useMemo(() => {
    const target = defaultDate ?? new Date();
    const idx = weeks.findIndex((w) => {
      if (!w.dateStart || !w.dateEnd) return false;
      const start = startOfDay(parseISO(w.dateStart));
      const end = endOfDay(parseISO(w.dateEnd));
      return isWithinInterval(target, { start, end });
    });
    return idx >= 0 ? idx : 0;
  }, [weeks, defaultDate]);

  const [centerIndex, setCenterIndex] = useState(initialWeekIndex);

  const defaultAnchorMs =
    defaultDate != null && !Number.isNaN(defaultDate.getTime()) ? defaultDate.getTime() : null;

  useEffect(() => {
    if (weeks.length === 0) return;
    const target = defaultAnchorMs != null ? new Date(defaultAnchorMs) : new Date();
    const idx = weeks.findIndex((w) => {
      if (!w.dateStart || !w.dateEnd) return false;
      const start = startOfDay(parseISO(w.dateStart));
      const end = endOfDay(parseISO(w.dateEnd));
      return isWithinInterval(target, { start, end });
    });
    const next = idx >= 0 ? idx : 0;
    const clamped = Math.min(Math.max(0, next), weeks.length - 1);
    setCenterIndex(clamped);
  }, [weeks, defaultAnchorMs]);

  const centerWeek = weeks[centerIndex];
  const goPrev = () => setCenterIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCenterIndex((i) => Math.min(weeks.length - 1, i + 1));

  const currentWeekIndex = useMemo(() => {
    const now = new Date();
    return weeks.findIndex((w) => {
      if (!w.dateStart || !w.dateEnd) return false;
      return isWithinInterval(now, {
        start: startOfDay(parseISO(w.dateStart)),
        end: endOfDay(parseISO(w.dateEnd)),
      });
    });
  }, [weeks]);

  const goToTodayWeek = useCallback(() => {
    if (currentWeekIndex >= 0) setCenterIndex(currentWeekIndex);
  }, [currentWeekIndex]);

  const prevViewRef = useRef<'week' | 'month' | null>(null);
  const monthListActiveElRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (view === 'month' && currentWeekIndex >= 0 && prevViewRef.current !== 'month') {
      setCenterIndex(currentWeekIndex);
    }
    prevViewRef.current = view;
  }, [view, currentWeekIndex]);

  useLayoutEffect(() => {
    if (weeks.length === 0) return;
    if (view !== 'month' || currentWeekIndex < 0 || centerIndex !== currentWeekIndex) return;
    monthListActiveElRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [weeks.length, view, centerIndex, currentWeekIndex]);

  const quickNavWeeks = useMemo(() => {
    const start = Math.max(0, centerIndex - 2);
    const end = Math.min(weeks.length, start + 5);
    return weeks.slice(start, end);
  }, [weeks, centerIndex]);

  const weekJumpId = useId();
  const progressPct = weeks.length > 1 ? Math.round((centerIndex / (weeks.length - 1)) * 100) : 100;

  if (weeks.length === 0) return null;

  const isCenterCurrentWeek =
    centerWeek?.dateStart &&
    centerWeek?.dateEnd &&
    isWithinInterval(new Date(), {
      start: startOfDay(parseISO(centerWeek.dateStart)),
      end: endOfDay(parseISO(centerWeek.dateEnd)),
    });

  return (
    <div className={cn(compact ? 'flex flex-col gap-2 sm:gap-5 md:gap-3' : 'flex flex-col gap-3 sm:gap-6 md:gap-4', className)}>
      <div
        className={cn(
          'sticky z-20 w-full rounded-lg border border-indigo-100/60 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90 dark:border-indigo-900/45 dark:bg-zinc-950/95 md:rounded-2xl md:border-violet-100/80 md:bg-background/90 md:shadow-sm md:dark:border-violet-900/40 md:dark:bg-background/90',
          compact
            ? 'flex flex-col gap-1 p-1 max-sm:rounded-md sm:gap-2.5 sm:p-3 md:gap-2 md:p-2'
            : 'flex flex-col gap-1 p-1 max-sm:rounded-md sm:gap-2.5 sm:p-3 md:gap-2 md:p-2',
        )}
        style={{
          top: 'max(env(safe-area-inset-top, 0px), var(--app-header-sticky-top, var(--header-height, 0px)))',
        }}
      >
        <p className="sr-only" aria-live="polite" aria-atomic>
          {centerWeek
            ? `Seçili ${centerWeek.weekNumber}. hafta, ${centerWeek.dateStart && centerWeek.dateEnd ? formatDateRangeProminent(centerWeek.dateStart, centerWeek.dateEnd) : ''}`
            : ''}
        </p>
        <div
          className={cn(
            '-mx-0.5 hidden max-w-full flex-nowrap items-center justify-center gap-x-2 gap-y-0.5 overflow-x-auto px-0.5 pb-0.5 text-[10px] text-muted-foreground sm:flex sm:justify-start sm:flex-wrap sm:gap-x-3 sm:text-xs',
            compact && 'sm:pb-0',
          )}
        >
          <span className="shrink-0 font-medium text-indigo-950 dark:text-indigo-100 sm:text-foreground">Renk</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <span className="size-2 shrink-0 rounded-full bg-amber-400 ring-1 ring-amber-500/35" aria-hidden />
            Belirli
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <span className="size-2 shrink-0 rounded-full bg-cyan-400 ring-1 ring-cyan-500/35" aria-hidden />
            İş
          </span>
        </div>

        <div
          className={cn(
            'grid max-sm:grid-cols-2 max-sm:items-end max-sm:gap-1.5 sm:flex sm:flex-row sm:items-end',
            compact ? 'gap-1.5 sm:gap-2.5' : 'gap-1.5 sm:gap-3',
          )}
        >
          <div className={cn('flex min-w-0 flex-1 flex-col', compact ? 'gap-0.5 sm:gap-1.5' : 'gap-0.5 sm:gap-2')}>
            <Label htmlFor={weekJumpId} className="text-[9px] leading-none text-muted-foreground sm:text-sm">
              Haftaya git
            </Label>
            <select
              id={weekJumpId}
              value={centerWeek?.id ?? ''}
              onChange={(e) => {
                const idx = weeks.findIndex((w) => w.id === e.target.value);
                if (idx >= 0) setCenterIndex(idx);
              }}
              className="min-h-8 w-full rounded-md border border-indigo-100/80 bg-zinc-50/80 px-1.5 py-1 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/45 dark:border-indigo-900/50 dark:bg-zinc-900/50 sm:min-h-11 sm:rounded-xl sm:border-input sm:bg-background sm:px-3 sm:py-2 sm:text-sm sm:focus-visible:ring-violet-400/50 md:min-h-9 md:py-1.5 md:text-xs"
              aria-label="Listeden hafta seçin"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.weekNumber}. hafta
                  {w.dateStart && w.dateEnd ? ` · ${formatWeekOptionDates(w.dateStart, w.dateEnd)}` : ''}
                </option>
              ))}
            </select>
          </div>
          {onViewChange && (
            <div className={cn('flex min-w-0 flex-col sm:min-w-[11rem]', compact ? 'gap-0.5 sm:gap-1.5' : 'gap-0.5 sm:gap-2')}>
              <span className="block text-[9px] font-medium leading-none text-muted-foreground sm:text-sm">Görünüm</span>
              <div className="grid grid-cols-2 gap-px rounded-md border border-border/50 bg-muted/20 p-px dark:bg-muted/10 sm:flex sm:gap-1 sm:rounded-xl sm:border-0 sm:bg-transparent sm:p-0">
                <button
                  type="button"
                  onClick={() => onViewChange('week')}
                  className={cn(
                    'flex min-h-7 items-center justify-center gap-0.5 rounded-[0.2rem] border px-1 py-0.5 text-[10px] font-semibold transition-colors sm:min-h-10 sm:flex-1 sm:rounded-lg sm:px-2 sm:text-sm md:min-h-8 md:py-0.5 md:text-xs',
                    view === 'week' ? BILSEM_VIEW_TAB_STYLES.a.active : BILSEM_VIEW_TAB_STYLES.a.idle,
                  )}
                  aria-pressed={view === 'week'}
                >
                  <CalendarDays className="size-3 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  Hafta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentWeekIndex >= 0) setCenterIndex(currentWeekIndex);
                    onViewChange('month');
                  }}
                  className={cn(
                    'flex min-h-7 items-center justify-center gap-0.5 rounded-[0.2rem] border px-1 py-0.5 text-[10px] font-semibold transition-colors sm:min-h-10 sm:flex-1 sm:rounded-lg sm:px-2 sm:text-sm md:min-h-8 md:py-0.5 md:text-xs',
                    view === 'month' ? BILSEM_VIEW_TAB_STYLES.b.active : BILSEM_VIEW_TAB_STYLES.b.idle,
                  )}
                  aria-pressed={view === 'month'}
                >
                  <LayoutList className="size-3 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  Liste
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="max-sm:pt-0">
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">
            <span className="max-sm:truncate">Konum</span>
            <span className="shrink-0 tabular-nums">
              {centerIndex + 1}/{weeks.length} · %{progressPct}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:h-2"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={weeks.length}
            aria-valuenow={centerIndex + 1}
            aria-label="Çalışma haftaları içindeki sıra"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400 transition-[width] duration-300 ease-out dark:from-indigo-500 dark:via-violet-500 dark:to-teal-500 sm:from-violet-400 sm:to-sky-400 sm:dark:from-violet-500 sm:dark:to-sky-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex w-full flex-col rounded-lg border border-indigo-100/50 bg-gradient-to-br from-indigo-50/30 via-background to-teal-50/15 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/20 dark:to-slate-950/30 md:flex-row md:items-center md:justify-between md:rounded-2xl md:border-violet-100/70 md:from-violet-50/40 md:to-sky-50/30 md:shadow-sm md:dark:border-violet-900/35 md:dark:from-violet-950/25',
          compact ? 'gap-1.5 p-1.5 max-sm:rounded-md sm:gap-4 sm:p-4 md:gap-3 md:p-3' : 'gap-2 p-2 max-sm:rounded-md sm:gap-4 sm:p-5 md:gap-3 md:p-3',
        )}
      >
        <div className="order-1 flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0 text-center max-sm:gap-1 md:order-2 md:gap-1.5 md:px-1">
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2 py-px text-[10px] font-bold tabular-nums text-white shadow-sm dark:from-indigo-500 dark:to-violet-600 sm:px-4 sm:py-2 sm:text-sm md:px-3 md:py-1 md:text-xs">
              {centerWeek?.weekNumber ?? centerIndex + 1}. hafta
            </span>
            {isCenterCurrentWeek && (
              <span className="rounded-full bg-emerald-200/80 px-1.5 py-px text-[9px] font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100 sm:px-2.5 sm:py-1 sm:text-xs md:px-2 md:py-0.5">
                Şu an
              </span>
            )}
          </div>
          <p className="hidden text-pretty text-[11px] font-medium leading-snug text-foreground sm:block sm:text-sm md:hidden">
            {centerWeek?.dateStart && centerWeek?.dateEnd
              ? formatDateRangeProminent(centerWeek.dateStart, centerWeek.dateEnd)
              : centerWeek?.title ?? '—'}
          </p>
          <p className="text-[9px] leading-tight text-muted-foreground max-sm:max-w-[14rem] sm:hidden">
            Üst satır: hafta. Ok veya şerit.
          </p>
          <p className="hidden text-[10px] text-muted-foreground sm:block md:hidden">İleri / geri veya listeden hafta.</p>
        </div>
        <div className="order-2 flex w-full flex-wrap items-center justify-center gap-1 max-sm:pt-0.5 md:order-1 md:w-auto md:justify-start md:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={centerIndex <= 0}
            aria-label="Önceki hafta"
            className="size-9 min-h-9 min-w-9 shrink-0 rounded-lg border-indigo-200/90 bg-white/90 dark:border-indigo-800/45 dark:bg-indigo-950/35 sm:size-11 sm:min-h-11 sm:min-w-11 sm:rounded-xl sm:border-violet-200/80 sm:dark:border-violet-800/50 sm:dark:bg-violet-950/40 md:size-9 md:min-h-9 md:min-w-9"
          >
            <ChevronLeft className="size-4 sm:size-5 md:size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={centerIndex >= weeks.length - 1}
            aria-label="Sonraki hafta"
            className="size-9 min-h-9 min-w-9 shrink-0 rounded-lg border-indigo-200/90 bg-white/90 dark:border-indigo-800/45 dark:bg-indigo-950/35 sm:size-11 sm:min-h-11 sm:min-w-11 sm:rounded-xl sm:border-violet-200/80 sm:dark:border-violet-800/50 sm:dark:bg-violet-950/40 md:size-9 md:min-h-9 md:min-w-9"
          >
            <ChevronRight className="size-4 sm:size-5 md:size-4" />
          </Button>
          {currentWeekIndex >= 0 && !isCenterCurrentWeek && (
            <Button
              variant="secondary"
              size="default"
              onClick={goToTodayWeek}
              className="min-h-9 flex-1 rounded-lg text-xs sm:min-h-11 sm:flex-none sm:rounded-xl sm:px-4 sm:text-sm md:min-h-8 md:px-3 md:text-xs"
            >
              Bugünün haftası
            </Button>
          )}
        </div>
      </div>

      {view === 'week' && centerWeek && (
        <div className="w-full space-y-2 md:space-y-4 lg:space-y-5">
          <WeekCardMain week={centerWeek} currentUserId={currentUserId} />
          <div className="rounded-lg border border-indigo-100/55 bg-indigo-50/20 p-1 dark:border-indigo-900/40 dark:bg-indigo-950/25 max-sm:py-1 sm:rounded-2xl sm:border-violet-100/60 sm:bg-violet-50/25 sm:p-5 sm:dark:border-violet-900/35 sm:dark:bg-violet-950/20 md:p-3">
            <p className="mb-1 text-center text-[9px] text-muted-foreground sm:mb-3 sm:hidden">
              Şeridi <span className="font-medium text-foreground">kaydır</span>
            </p>
            <p className="mb-2 hidden text-center text-sm text-muted-foreground sm:mb-3 sm:block md:mb-2 md:text-xs">
              Yakın haftalar — <span className="font-medium text-foreground">dokun</span> veya mobilde{' '}
              <span className="font-medium text-foreground">yana kaydır</span>
            </p>
            <div className="-mx-0.5 flex max-w-full snap-x snap-mandatory flex-nowrap justify-center gap-0.5 overflow-x-auto px-0.5 pb-0 [-webkit-overflow-scrolling:touch] sm:-mx-1 sm:gap-2 sm:px-1 sm:pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
              {quickNavWeeks.map((w) => {
                const isSelected = w.id === centerWeek.id;
                const isCurrent =
                  w.dateStart &&
                  w.dateEnd &&
                  isWithinInterval(new Date(), {
                    start: startOfDay(parseISO(w.dateStart)),
                    end: endOfDay(parseISO(w.dateEnd)),
                  });
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setCenterIndex(weeks.findIndex((x) => x.id === w.id))}
                    className={cn(
                      'min-h-7 min-w-16 shrink-0 snap-center rounded-md border px-1 py-0.5 text-[10px] font-semibold tabular-nums transition-colors active:scale-[0.98] sm:min-h-11 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm md:min-h-8 md:min-w-20 md:px-2 md:py-1 md:text-xs',
                      isSelected &&
                        'border-indigo-600 bg-gradient-to-b from-indigo-600 to-violet-600 text-white shadow-md dark:border-indigo-500 sm:shadow-sm',
                      !isSelected &&
                        isCurrent &&
                        'border-teal-300/80 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/45 dark:text-teal-100 sm:border-emerald-200 sm:bg-emerald-100/80 sm:text-emerald-900 sm:dark:border-emerald-800 sm:dark:bg-emerald-950/50 sm:dark:text-emerald-100',
                      !isSelected &&
                        !isCurrent &&
                        'border-indigo-100/90 bg-white/95 text-muted-foreground hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-zinc-900/40 dark:hover:bg-indigo-950/40 sm:border-violet-100 sm:hover:border-violet-200 sm:hover:bg-violet-50 sm:dark:border-violet-900 sm:dark:bg-violet-950/40 sm:dark:hover:bg-violet-900/40'
                    )}
                  >
                    {w.weekNumber}. hafta
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'month' && (
        <div className="w-full space-y-2 md:space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-indigo-100/65 bg-gradient-to-br from-indigo-50/45 to-teal-50/20 p-2.5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-950/40 sm:rounded-2xl sm:border-violet-100/70 sm:from-violet-50/50 sm:to-sky-50/30 sm:p-5 sm:dark:border-violet-900/35 md:p-3">
            <svg className="pointer-events-none absolute -bottom-8 end-0 size-32 text-violet-200/40 dark:text-violet-900/40" viewBox="0 0 128 128" fill="none" aria-hidden>
              <circle cx="100" cy="100" r="56" fill="currentColor" opacity="0.4" />
            </svg>
            <div className="relative flex items-start gap-2 sm:gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-violet-500 shadow-sm dark:bg-violet-950/60 dark:text-violet-300 sm:size-11 sm:rounded-2xl">
                <LayoutGrid className="size-4 sm:size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground sm:text-base">Tüm haftalar</h3>
                <p className="mt-0.5 text-pretty text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-sm sm:leading-relaxed">
                  Haftaya dokunun — haftalık görünüme geçilir.
                  <span className="hidden sm:inline">
                    {' '}
                    Rozetler: turuncu belirli gün, mavi öğretmen işi.
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {weeks.map((w) => {
              const isActive = w.id === centerWeek?.id;
              return (
                <div
                  key={w.id}
                  ref={isActive ? monthListActiveElRef : undefined}
                  className="min-h-0 scroll-mt-[calc(var(--header-height,0px)+0.75rem)]"
                >
                  <WeekCardCompact
                    week={w}
                    isActive={!!isActive}
                    currentUserId={currentUserId}
                    onClick={() => {
                      const idx = weeks.findIndex((x) => x.id === w.id);
                      if (idx >= 0) setCenterIndex(idx);
                      onViewChange?.('week');
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
