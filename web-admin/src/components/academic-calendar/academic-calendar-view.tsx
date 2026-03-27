'use client';

import { useState, useMemo, useEffect, useCallback, useId } from 'react';
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
import { format, parseISO, isWithinInterval, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { AssignedUserView, WeekWithItems } from './academic-calendar-timeline';
import { BelirliPill, OgretmenPill } from './academic-calendar-timeline';
import { cn } from '@/lib/utils';
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
  const start = parseISO(dateStart);
  const end = parseISO(dateEnd);
  const dayCount = differenceInDays(end, start) + 1;
  const days: { date: Date; label: string; gun: string; isToday: boolean }[] = [];
  const today = new Date();
  const d = new Date(start);
  while (d <= end) {
    const dayOfWeek = d.getDay();
    const gun = GUNLER[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    const dateCopy = new Date(d);
    days.push({
      date: dateCopy,
      label: format(d, 'd', { locale: tr }),
      gun,
      isToday: format(dateCopy, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
    });
    d.setDate(d.getDate() + 1);
  }

  const cols = Math.min(7, Math.max(1, dayCount));
  const monthLabel = format(start, 'MMMM', { locale: tr });
  const year = format(start, 'yyyy', { locale: tr });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100/90 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
            <CalendarRange className="size-[1.125rem]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 text-left">
            <p className={cn('font-semibold capitalize tracking-tight text-foreground', isMain ? 'text-base sm:text-xl' : 'text-sm sm:text-base')}>
              {monthLabel}{' '}
              <span className="font-normal text-muted-foreground">{year}</span>
            </p>
            <p className="text-sm text-muted-foreground">{start.getDate()}–{end.getDate()}. gün</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 self-stretch rounded-xl border border-violet-100/80 bg-violet-50/50 px-2.5 py-1.5 text-[11px] text-violet-900/80 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200/90 sm:self-auto sm:shrink-0">
          <svg className="size-4 shrink-0 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M3 10h18M8 2v4M16 2v4" />
          </svg>
          <span className="leading-snug">Haftanın günleri</span>
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:overflow-visible">
        <div
          className="inline-grid min-w-max gap-1 rounded-xl border border-violet-100/50 bg-gradient-to-b from-violet-50/35 to-sky-50/15 p-1.5 sm:min-w-0 sm:w-full sm:gap-1.5 sm:p-2 dark:border-violet-900/30 dark:from-violet-950/25 dark:to-slate-950/40"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.75rem, 1fr))` }}
        >
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                'flex min-h-12 min-w-10 flex-col items-center justify-center rounded-lg border py-1.5 transition-colors sm:min-h-14 sm:min-w-11',
                day.isToday
                  ? 'border-violet-300/70 bg-violet-100/80 shadow-sm ring-2 ring-violet-400/30 dark:border-violet-600/50 dark:bg-violet-950/50 dark:ring-violet-500/25'
                  : 'border-white/40 bg-white/50 dark:border-white/5 dark:bg-white/5'
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{day.gun}</span>
              <span
                className={cn(
                  'mt-0.5 text-sm font-bold tabular-nums sm:text-base',
                  day.isToday ? 'text-violet-700 dark:text-violet-200' : 'text-foreground'
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
    <div className="overflow-hidden rounded-2xl border border-violet-100/50 bg-card shadow-sm ring-1 ring-violet-100/30 dark:border-violet-900/25 dark:ring-violet-900/20">
      <div className="relative overflow-hidden border-b border-violet-100/40 bg-gradient-to-br from-violet-50/50 via-background to-sky-50/30 px-3 py-4 sm:px-5 sm:py-5 dark:border-violet-900/30 dark:from-violet-950/30 dark:via-background dark:to-slate-950/40">
        <CardPastelMesh variant="header" className="opacity-90 dark:opacity-60" />
        <div className="relative z-[1]">
          {week.dateStart && week.dateEnd ? (
            <WeekDaysRow dateStart={week.dateStart} dateEnd={week.dateEnd} isMain />
          ) : (
            <p className="text-center text-muted-foreground">{week.title ?? 'Tarih yok'}</p>
          )}
        </div>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        {belirli > 0 || ogretmen > 0 ? (
          <>
            {belirli > 0 && (
              <section
                className="relative overflow-hidden rounded-xl border border-orange-200/50 bg-gradient-to-br from-orange-50/80 to-amber-50/30 p-3 dark:border-orange-900/30 dark:from-orange-950/35 dark:to-amber-950/20"
                aria-labelledby="belirli-heading"
              >
                <CardPastelMesh variant="amber" className="opacity-50 dark:opacity-40" />
                <div className="relative z-[1]">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-orange-100/90 text-orange-600 dark:bg-orange-950/60 dark:text-orange-300">
                      <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 id="belirli-heading" className="text-sm font-semibold text-orange-950 dark:text-orange-50">
                        Belirli gün ve haftalar
                      </h3>
                    </div>
                    <span className="rounded-md bg-orange-200/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-orange-900 dark:bg-orange-900/40 dark:text-orange-100">
                      {belirli}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {week.belirliGunHafta?.map((item) => {
                      const assigned = item.assignedUsers ?? [];
                      const isMyTask = !!(currentUserId && assigned.some((a) => a.userId === currentUserId));
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-orange-200/40 bg-white/70 py-2 pl-2.5 pr-2 dark:border-orange-900/35 dark:bg-orange-950/20"
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
                className="relative overflow-hidden rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50/80 to-blue-50/25 p-3 dark:border-sky-900/30 dark:from-sky-950/35 dark:to-blue-950/20"
                aria-labelledby="ogretmen-heading"
              >
                <CardPastelMesh variant="sky" className="opacity-50 dark:opacity-40" />
                <div className="relative z-[1]">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-sky-100/90 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
                      <ClipboardList className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 id="ogretmen-heading" className="text-sm font-semibold text-sky-950 dark:text-sky-50">
                        Öğretmen işleri
                      </h3>
                    </div>
                    <span className="rounded-md bg-sky-200/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                      {ogretmen}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {week.ogretmenIsleri?.map((item) => {
                      const assigned = item.assignedUsers ?? [];
                      const isMyTask = !!(currentUserId && assigned.some((a) => a.userId === currentUserId));
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-sky-200/40 bg-white/70 py-2 pl-2.5 pr-2 dark:border-sky-900/35 dark:bg-sky-950/20"
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-violet-200/60 bg-violet-50/30 py-10 dark:border-violet-900/40 dark:bg-violet-950/20">
            <svg className="size-12 text-violet-300 dark:text-violet-700" viewBox="0 0 48 48" fill="none" aria-hidden>
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
        'group flex min-h-0 flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2',
        isActive
          ? 'border-violet-300/70 bg-gradient-to-b from-violet-50/90 to-card shadow-md ring-2 ring-violet-300/30 dark:border-violet-700/50 dark:from-violet-950/50'
          : 'border-violet-100/80 bg-card hover:border-violet-200 hover:shadow-md dark:border-violet-900/40'
      )}
    >
      <div className="relative flex items-start justify-between gap-2 overflow-hidden border-b border-violet-100/50 bg-gradient-to-r from-violet-50/60 to-sky-50/35 px-3 py-2.5 dark:border-violet-900/30 dark:from-violet-950/40 dark:to-sky-950/20">
        <svg className="pointer-events-none absolute -end-2 -top-4 size-16 text-violet-200/40 dark:text-violet-800/25" viewBox="0 0 96 96" fill="none" aria-hidden>
          <circle cx="72" cy="24" r="40" fill="currentColor" opacity="0.35" />
        </svg>
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold tabular-nums sm:text-lg">{week.weekNumber}. hafta</span>
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
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-violet-500 dark:bg-violet-950/50 dark:text-violet-300">
          <LayoutGrid className="size-4" strokeWidth={2} aria-hidden />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
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

  useEffect(() => {
    const target = defaultDate ?? new Date();
    const idx = weeks.findIndex((w) => {
      if (!w.dateStart || !w.dateEnd) return false;
      const start = startOfDay(parseISO(w.dateStart));
      const end = endOfDay(parseISO(w.dateEnd));
      return isWithinInterval(target, { start, end });
    });
    const next = idx >= 0 ? idx : 0;
    const clamped = weeks.length > 0 ? Math.min(Math.max(0, next), weeks.length - 1) : 0;
    setCenterIndex(clamped);
  }, [weeks]);

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
    <div className={cn('space-y-5 sm:space-y-6', className)}>
      <p className="sr-only" aria-live="polite" aria-atomic>
        {centerWeek
          ? `Seçili ${centerWeek.weekNumber}. hafta, ${centerWeek.dateStart && centerWeek.dateEnd ? formatDateRangeProminent(centerWeek.dateStart, centerWeek.dateEnd) : ''}`
          : ''}
      </p>

      <div
        className="sticky z-20 space-y-3 rounded-2xl border border-violet-100/80 bg-background/90 p-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:border-violet-900/40 dark:bg-background/90"
        style={{ top: 'var(--header-height)' }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Renkler</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full bg-orange-300 ring-1 ring-orange-400/30" aria-hidden />
            Belirli gün / hafta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full bg-sky-300 ring-1 ring-sky-400/30" aria-hidden />
            Öğretmen işi
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={weekJumpId} className="text-muted-foreground">
              Haftaya git
            </Label>
            <select
              id={weekJumpId}
              value={centerWeek?.id ?? ''}
              onChange={(e) => {
                const idx = weeks.findIndex((w) => w.id === e.target.value);
                if (idx >= 0) setCenterIndex(idx);
              }}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
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
            <div className="space-y-2 sm:min-w-[11rem]">
              <span className="block text-sm font-medium text-muted-foreground">Görünüm</span>
              <div className="flex rounded-xl border border-violet-100/80 bg-muted/30 p-1 dark:border-violet-900/50">
                <button
                  type="button"
                  onClick={() => onViewChange('week')}
                  className={cn(
                    'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors',
                    view === 'week'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={view === 'week'}
                >
                  <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden />
                  Hafta
                </button>
                <button
                  type="button"
                  onClick={() => onViewChange('month')}
                  className={cn(
                    'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors',
                    view === 'month'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={view === 'month'}
                >
                  <LayoutList className="size-4 shrink-0 opacity-70" aria-hidden />
                  Liste
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Yıl içindeki konum</span>
            <span className="tabular-nums">
              {centerIndex + 1}/{weeks.length} · %{progressPct}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={weeks.length}
            aria-valuenow={centerIndex + 1}
            aria-label="Çalışma haftaları içindeki sıra"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400 transition-[width] duration-300 ease-out dark:from-violet-500 dark:to-sky-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-violet-100/70 bg-gradient-to-br from-violet-50/40 via-background to-sky-50/30 p-4 shadow-sm dark:border-violet-900/35 dark:from-violet-950/25 dark:to-slate-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-start">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={centerIndex <= 0}
            aria-label="Önceki hafta"
            className="size-11 min-h-11 min-w-11 shrink-0 rounded-xl border-violet-200/80 bg-white/80 dark:border-violet-800/50 dark:bg-violet-950/40"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={centerIndex >= weeks.length - 1}
            aria-label="Sonraki hafta"
            className="size-11 min-h-11 min-w-11 shrink-0 rounded-xl border-violet-200/80 bg-white/80 dark:border-violet-800/50 dark:bg-violet-950/40"
          >
            <ChevronRight className="size-5" />
          </Button>
          {currentWeekIndex >= 0 && !isCenterCurrentWeek && (
            <Button
              variant="secondary"
              size="default"
              onClick={goToTodayWeek}
              className="min-h-11 flex-1 rounded-xl text-sm sm:flex-none sm:px-4"
            >
              Bugünün haftası
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-violet-500/90 px-4 py-2 text-sm font-bold tabular-nums text-white shadow-sm dark:bg-violet-600/90">
              {centerWeek?.weekNumber ?? centerIndex + 1}. hafta
            </span>
            {isCenterCurrentWeek && (
              <span className="rounded-full bg-emerald-200/80 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                Şu an
              </span>
            )}
          </div>
          <p className="text-pretty text-sm font-medium leading-snug text-foreground">
            {centerWeek?.dateStart && centerWeek?.dateEnd
              ? formatDateRangeProminent(centerWeek.dateStart, centerWeek.dateEnd)
              : centerWeek?.title ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">İleri / geri veya yukarıdan hafta seçin</p>
        </div>
      </div>

      {view === 'week' && centerWeek && (
        <div className="space-y-6">
          <WeekCardMain week={centerWeek} currentUserId={currentUserId} />
          <div className="rounded-2xl border border-violet-100/60 bg-violet-50/25 p-4 dark:border-violet-900/35 dark:bg-violet-950/20 sm:p-5">
            <p className="mb-3 text-center text-sm text-muted-foreground">
              Yakın haftalar — <span className="font-medium text-foreground">dokun</span> veya mobilde{' '}
              <span className="font-medium text-foreground">yana kaydır</span>
            </p>
            <div className="-mx-1 flex max-w-full snap-x snap-mandatory flex-nowrap justify-start gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:justify-center sm:overflow-visible">
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
                      'min-h-11 min-w-[5.5rem] shrink-0 snap-center rounded-xl border px-3 py-2.5 text-sm font-semibold tabular-nums transition-colors active:scale-[0.98]',
                      isSelected && 'border-violet-500 bg-violet-500 text-white shadow-sm dark:border-violet-400 dark:bg-violet-600',
                      !isSelected &&
                        isCurrent &&
                        'border-emerald-200 bg-emerald-100/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
                      !isSelected &&
                        !isCurrent &&
                        'border-violet-100 bg-white/90 text-muted-foreground hover:border-violet-200 hover:bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40 dark:hover:bg-violet-900/40'
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
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-violet-100/70 bg-gradient-to-br from-violet-50/50 to-sky-50/30 p-5 dark:border-violet-900/35 dark:from-violet-950/30 dark:to-slate-950/40">
            <svg className="pointer-events-none absolute -bottom-8 end-0 size-32 text-violet-200/40 dark:text-violet-900/40" viewBox="0 0 128 128" fill="none" aria-hidden>
              <circle cx="100" cy="100" r="56" fill="currentColor" opacity="0.4" />
            </svg>
            <div className="relative flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-violet-500 shadow-sm dark:bg-violet-950/60 dark:text-violet-300">
                <LayoutGrid className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Tüm haftalar</h3>
                <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                  Bir haftaya dokunun; haftalık görünüme geçilir. Rozetlerde belirli gün (turuncu) ve öğretmen işi (mavi) sayıları yer alır.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {weeks.map((w) => {
              const isActive = w.id === centerWeek?.id;
              return (
                <WeekCardCompact
                  key={w.id}
                  week={w}
                  isActive={!!isActive}
                  currentUserId={currentUserId}
                  onClick={() => {
                    const idx = weeks.findIndex((x) => x.id === w.id);
                    if (idx >= 0) setCenterIndex(idx);
                    onViewChange?.('week');
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
