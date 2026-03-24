'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isWithinInterval, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { WeekWithItems } from './academic-calendar-timeline';
import { BelirliPill, OgretmenPill } from './academic-calendar-timeline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface AcademicCalendarViewProps {
  weeks: WeekWithItems[];
  defaultDate?: Date;
  view?: 'week' | 'month';
  onViewChange?: (view: 'week' | 'month') => void;
  className?: string;
  /** Takvimde "Sizin göreviniz" göstermek için (teacher) */
  currentUserId?: string | null;
}

/** Tarih aralığı – ay belirgin (örn: 8–12 EYLÜL 2025) */
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

/** Haftanın günlerini grid gösterir – ay belirgin, günler okunaklı */
function WeekDaysRow({
  dateStart,
  dateEnd,
  isMain = false,
}: {
  dateStart: string;
  dateEnd: string;
  isMain?: boolean;
}) {
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
  const monthLabel = format(start, 'MMMM', { locale: tr }).toUpperCase();
  const year = format(start, 'yyyy', { locale: tr });
  const dateRangeShort = `${start.getDate()}–${end.getDate()}`;

  return (
    <div className="space-y-3 text-center">
      <div className="flex flex-col items-center gap-1">
        <span className={cn('font-bold uppercase tracking-wide', isMain ? 'text-2xl text-primary' : 'text-lg text-foreground')}>
          {monthLabel}
        </span>
        {!isMain && (
          <span className="text-sm font-medium text-muted-foreground">
            {dateRangeShort} {year}
          </span>
        )}
      </div>
      <div
        className="grid gap-2 rounded-xl border border-border/40 bg-muted/20 p-3 text-center"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl py-2.5 transition-colors',
              day.isToday && 'bg-violet-100 ring-2 ring-violet-500/50 font-semibold dark:bg-violet-900/40 dark:ring-violet-400/30'
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">{day.gun}</span>
            <span className={cn('font-bold tabular-nums', day.isToday ? 'text-violet-600 dark:text-violet-400' : 'text-foreground')}>{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tek hafta kartı – ana odaklı (tek hafta görünümü için büyük) */
function WeekCardMain({
  week,
  isCurrentWeek,
  currentUserId,
}: {
  week: WeekWithItems;
  isCurrentWeek: boolean;
  currentUserId?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-violet-200/60 bg-card shadow-xl shadow-violet-900/5 ring-2 ring-violet-500/10 dark:border-violet-900/30">
      <div className="border-b bg-gradient-to-b from-violet-50/80 to-transparent px-6 py-5 text-center dark:from-violet-950/20">
        {week.dateStart && week.dateEnd ? (
          <WeekDaysRow dateStart={week.dateStart} dateEnd={week.dateEnd} isMain />
        ) : (
          <p className="text-muted-foreground">{week.title ?? 'Tarih yok'}</p>
        )}
      </div>
      <div className="flex flex-col gap-6 p-6">
        {((week.belirliGunHafta?.length ?? 0) > 0 || (week.ogretmenIsleri?.length ?? 0) > 0) ? (
          <>
            {(week.belirliGunHafta?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Belirli Gün ve Haftalar
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {week.belirliGunHafta?.map((item) => {
                    const isMyTask = currentUserId && (item.assignedUsers ?? []).some((a) => a.userId === currentUserId);
                    const assignedNames = (item.assignedUsers ?? []).map((a) => a.displayName || '—').filter(Boolean);
                    return (
                      <div key={item.id} className="flex flex-col items-center gap-1">
                        <div className="flex flex-wrap justify-center gap-1">
                          <BelirliPill title={item.title} path={item.path} />
                          {isMyTask && (
                            <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                              Sizin göreviniz
                            </span>
                          )}
                        </div>
                        {assignedNames.length > 0 && !isMyTask && (
                          <span className="text-xs text-muted-foreground">Görevli: {assignedNames.join(', ')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(week.ogretmenIsleri?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
                <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                  Öğretmen İşleri
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {week.ogretmenIsleri?.map((item) => (
                    <OgretmenPill key={item.id} title={item.title} path={item.path} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground italic">Bu haftada etkinlik yok</p>
        )}
      </div>
    </div>
  );
}

/** Kısa hafta kartı – ay görünümü grid için */
function WeekCardCompact({ week, isActive, onClick }: { week: WeekWithItems; isActive: boolean; onClick?: () => void }) {
  const isCurrentWeek =
    week.dateStart &&
    week.dateEnd &&
    isWithinInterval(new Date(), {
      start: startOfDay(parseISO(week.dateStart)),
      end: endOfDay(parseISO(week.dateEnd)),
    });
  const Wrapper = onClick ? 'button' : 'div';
  const props = onClick ? { type: 'button' as const, onClick } : {};
  return (
    <Wrapper
      {...props}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-200',
        isActive
          ? 'border-violet-500 bg-card shadow-xl shadow-violet-500/20 ring-2 ring-violet-400/30 -translate-y-0.5'
          : 'cursor-pointer border-violet-200/60 bg-card shadow-md hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-xl hover:shadow-violet-500/10 dark:border-violet-900/40 dark:hover:border-violet-700/60'
      )}
    >
      <div className="shrink-0 border-b border-violet-200/40 bg-gradient-to-b from-violet-50/80 to-transparent px-4 py-3 text-center dark:border-violet-900/30 dark:from-violet-950/30">
        <span className="font-bold tabular-nums">{week.weekNumber}. Hafta</span>
        {isCurrentWeek && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            Bugün
          </span>
        )}
        {week.dateStart && week.dateEnd && (
          <p className="mt-1 text-xs text-muted-foreground">{formatDateRangeProminent(week.dateStart, week.dateEnd)}</p>
        )}
      </div>
      <div className="min-h-[80px] flex-1 p-3">
        {((week.belirliGunHafta?.length ?? 0) > 0 || (week.ogretmenIsleri?.length ?? 0) > 0) ? (
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-2">
            {(week.belirliGunHafta ?? []).map((i) => {
              const assigned = (i.assignedUsers ?? []).map((a) => a.displayName || '—').filter(Boolean);
              return (
                <div key={i.id} className="flex flex-col items-center gap-0.5">
                  <BelirliPill title={i.title} path={i.path} className="text-xs" />
                  {assigned.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">Görevli: {assigned.join(', ')}</span>
                  )}
                </div>
              );
            })}
            {(week.ogretmenIsleri ?? []).map((i) => {
              const assigned = (i.assignedUsers ?? []).map((a) => a.displayName || '—').filter(Boolean);
              return (
                <div key={i.id} className="flex flex-col items-center gap-0.5">
                  <OgretmenPill title={i.title} path={i.path} className="text-xs" />
                  {assigned.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">Görevli: {assigned.join(', ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-2 text-center text-xs italic text-muted-foreground">—</p>
        )}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when weeks change (e.g. year switch)
  }, [weeks]);

  const centerWeek = weeks[centerIndex];
  const goPrev = () => setCenterIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCenterIndex((i) => Math.min(weeks.length - 1, i + 1));

  /** Haftalık: tek odaklı – seçili hafta büyük kart; hızlı geçiş için yakın hafta numaraları */
  const quickNavWeeks = useMemo(() => {
    const start = Math.max(0, centerIndex - 2);
    const end = Math.min(weeks.length, start + 5);
    return weeks.slice(start, end);
  }, [weeks, centerIndex]);

  if (weeks.length === 0) return null;

  const isCenterCurrentWeek =
    centerWeek?.dateStart &&
    centerWeek?.dateEnd &&
    isWithinInterval(new Date(), {
      start: startOfDay(parseISO(centerWeek.dateStart)),
      end: endOfDay(parseISO(centerWeek.dateEnd)),
    });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-200/40 bg-gradient-to-r from-violet-50/50 to-purple-50/50 px-5 py-4 shadow-sm dark:border-violet-900/30 dark:from-violet-950/20 dark:to-purple-950/20">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={centerIndex <= 0}
          className="min-w-[100px] gap-1.5"
          aria-label="Önceki hafta"
        >
          <ChevronLeft className="size-4" />
          Önceki
        </Button>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-violet-600 px-4 py-2 text-lg font-bold tabular-nums text-white shadow-md shadow-violet-500/20">
              {centerWeek?.weekNumber ?? centerIndex + 1}. Hafta
            </span>
            {isCenterCurrentWeek && (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                Bu hafta
              </span>
            )}
          </div>
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {centerWeek?.dateStart && centerWeek?.dateEnd
              ? formatDateRangeProminent(centerWeek.dateStart, centerWeek.dateEnd)
              : centerWeek?.title ?? '—'}
          </span>
          <span className="text-xs text-muted-foreground">
            {centerIndex + 1} / {weeks.length} hafta
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={centerIndex >= weeks.length - 1}
          className="min-w-[100px] gap-1.5"
          aria-label="Sonraki hafta"
        >
          Sonraki
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Haftalık görünüm: tek hafta odaklı – net, anlaşılır */}
      {view === 'week' && centerWeek && (
        <div className="space-y-4">
          <WeekCardMain
            week={centerWeek}
            isCurrentWeek={
              !!(centerWeek.dateStart &&
                centerWeek.dateEnd &&
                isWithinInterval(new Date(), {
                  start: startOfDay(parseISO(centerWeek.dateStart)),
                  end: endOfDay(parseISO(centerWeek.dateEnd)),
                }))
            }
            currentUserId={currentUserId}
          />
          <div className="rounded-2xl border border-violet-200/40 bg-violet-50/30 p-5 text-center dark:border-violet-900/30 dark:bg-violet-950/20">
            <p className="mb-4 text-sm font-medium text-muted-foreground">Diğer haftalara geçmek için hafta numarasına tıklayın</p>
            <div className="flex flex-wrap justify-center gap-2">
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
                      'rounded-xl px-4 py-2.5 text-sm font-bold tabular-nums transition-all duration-200',
                      isSelected && 'bg-violet-600 text-white shadow-md shadow-violet-500/25',
                      !isSelected && isCurrent && 'bg-amber-100 text-amber-800 ring-1 ring-amber-300/50 dark:bg-amber-900/50 dark:text-amber-200 dark:ring-amber-700/50',
                      !isSelected && !isCurrent && 'bg-white/80 text-muted-foreground hover:bg-violet-100 hover:text-foreground dark:bg-violet-900/30 dark:hover:bg-violet-800/40'
                    )}
                  >
                    {w.weekNumber}. Hafta
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tüm haftalar görünümü */}
      {view === 'month' && (
        <div className="mt-4 space-y-4">
          <h3 className="rounded-xl bg-muted/30 px-4 py-3 text-base font-semibold text-muted-foreground">Tüm Haftalar — Kartlara tıklayarak hafta detayına geçin</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {weeks.map((w) => {
              const isActive = w.id === centerWeek?.id;
              return (
                <WeekCardCompact
                  key={w.id}
                  week={w}
                  isActive={!!isActive}
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
