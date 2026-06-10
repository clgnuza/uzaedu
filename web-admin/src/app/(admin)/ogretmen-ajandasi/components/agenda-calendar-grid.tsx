'use client';

import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { agendaEventChipClassForEvent } from './agenda-source-theme';

export type CalendarEvent = {
  id: string;
  type: 'note' | 'task' | 'school_event' | 'platform_event' | 'duty' | 'exam_duty' | 'student_note' | 'parent_meeting' | 'belirli_gun_hafta' | 'timetable';
  title: string;
  start: string;
  end?: string;
  source: string;
  color?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

const WEEKDAY_LABELS = [
  { short: 'Pzt', long: 'Pazartesi' },
  { short: 'Sal', long: 'Salı' },
  { short: 'Çar', long: 'Çarşamba' },
  { short: 'Per', long: 'Perşembe' },
  { short: 'Cum', long: 'Cuma' },
  { short: 'Cmt', long: 'Cumartesi' },
  { short: 'Paz', long: 'Pazar' },
] as const;

function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const ymd = format(date, 'yyyy-MM-dd');
  return events.filter((ev) => ev.start.slice(0, 10) === ymd);
}

function isWeekendMonSun(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function maxVisibleEvents(viewMode: 'month' | 'week' | 'day', compact: boolean): number {
  if (viewMode === 'day') return 48;
  if (viewMode === 'week') return compact ? 4 : 6;
  return compact ? 2 : 3;
}

function CalendarEventChip({
  ev,
  onEventClick,
  onEventDrop,
  compact,
}: {
  ev: CalendarEvent;
  onEventClick?: (ev: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newDate: string) => void;
  compact?: boolean;
}) {
  const draggable = ev.type === 'task' && !!onEventDrop && !String(ev.id).includes('~');
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        if (draggable) e.dataTransfer.setData('text/event-id', ev.id);
      }}
      className={cn(
        'group/chip flex w-full min-w-0 items-start gap-1 rounded-md text-left transition-all hover:brightness-[1.03] active:scale-[0.99] touch-manipulation',
        compact ? 'px-1 py-0.5' : 'px-1.5 py-1',
        agendaEventChipClassForEvent(ev),
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick?.(ev);
      }}
      title={`${ev.title}${ev.createdBy ? ` • ${ev.createdBy}` : ''}${draggable ? ' (sürükleyerek tarih değiştir)' : ''}`}
    >
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('line-clamp-2 font-semibold leading-tight', compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]')}>
          {ev.title}
        </span>
        {ev.createdBy && !compact && (
          <span className="mt-0.5 line-clamp-1 text-[9px] font-medium opacity-75 max-sm:hidden">
            {ev.createdBy}
          </span>
        )}
      </span>
    </button>
  );
}

function DayCell({
  date,
  month,
  events,
  viewMode,
  onDayClick,
  onEventClick,
  onEventDrop,
}: {
  date: Date;
  month: Date;
  events: CalendarEvent[];
  viewMode: 'month' | 'week' | 'day';
  onDayClick?: (date: Date) => void;
  onEventClick?: (ev: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newDate: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dayEvents = getEventsForDay(events, date);
  const isCurrentMonth = isSameMonth(date, month);
  const isToday = isSameDay(date, new Date());
  const weekend = isWeekendMonSun(date);
  const compact = viewMode === 'month';
  const limit = maxVisibleEvents(viewMode, compact);
  const visible = dayEvents.slice(0, limit);
  const overflow = dayEvents.length - visible.length;

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col rounded-lg border bg-background/90 transition-all duration-200 touch-manipulation',
        viewMode === 'month' && 'min-h-[88px] sm:min-h-[108px] md:min-h-[120px]',
        viewMode === 'week' && 'min-h-[112px] sm:min-h-[136px] md:min-h-[152px]',
        viewMode === 'day' && 'min-h-[200px]',
        'cursor-pointer hover:border-border/80 hover:bg-muted/25 hover:shadow-sm',
        weekend && !isToday && 'bg-muted/20',
        !isCurrentMonth && viewMode === 'month' && 'opacity-60',
        isToday && 'border-primary/35 bg-primary/5 ring-1 ring-primary/20',
        dragOver && 'border-primary/50 bg-primary/8 ring-2 ring-primary/25',
      )}
      onClick={() => onDayClick?.(date)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
        if (onEventDrop) e.dataTransfer.dropEffect = 'move';
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('text/event-id');
        if (id && onEventDrop) onEventDrop(id, format(date, 'yyyy-MM-dd'));
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onDayClick?.(date)}
    >
      <div className="flex items-center justify-between gap-1 px-2 pt-2 pb-1">
        <span
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums sm:size-8 sm:text-xs',
            isToday
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
              : isCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {format(date, 'd')}
        </span>
        {dayEvents.length > 0 && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
              isToday ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {dayEvents.length}
          </span>
        )}
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-1.5 pb-1.5 sm:gap-1 sm:pb-2',
          viewMode === 'day' && 'max-h-none overflow-y-auto px-2 pb-3 sm:px-3',
        )}
      >
        {visible.map((ev) => (
          <CalendarEventChip
            key={`${ev.type}-${ev.id}`}
            ev={ev}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
            compact={compact}
          />
        ))}
        {overflow > 0 && (
          <span className="px-1 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
            +{overflow} daha
          </span>
        )}
        {dayEvents.length === 0 && viewMode === 'day' && (
          <p className="py-8 text-center text-xs text-muted-foreground">Bu gün için kayıt yok</p>
        )}
      </div>
    </div>
  );
}

export function AgendaCalendarGrid({
  month,
  events,
  onEventClick,
  onDayClick,
  onEventDrop,
  viewMode = 'month',
}: {
  month: Date;
  events: CalendarEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onEventDrop?: (eventId: string, newDate: string) => void;
  viewMode?: 'month' | 'week' | 'day';
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekStart = startOfWeek(month, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(month, { weekStartsOn: 1 });
  const calStart = viewMode === 'day' ? month : viewMode === 'week' ? weekStart : startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = viewMode === 'day' ? month : viewMode === 'week' ? weekEnd : endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
    if (viewMode === 'day') break;
  }
  const weeks =
    viewMode === 'day'
      ? [days]
      : Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, (i + 1) * 7));

  const cols = viewMode === 'day' ? 1 : 7;

  return (
    <div className="table-x-scroll -mx-0.5 sm:mx-0">
      <div className="min-w-[min(100%,280px)] overflow-hidden rounded-2xl border border-border/60 bg-linear-to-b from-muted/25 via-card to-card p-1.5 shadow-sm ring-1 ring-black/2 dark:ring-white/5 sm:p-2">
        {viewMode === 'day' && (
          <div className="mb-2 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-center sm:px-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Gün görünümü</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-foreground sm:text-base">
              {format(month, 'EEEE, d MMMM yyyy', { locale: tr })}
            </p>
          </div>
        )}

        <div
          className="grid gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {viewMode !== 'day' &&
            WEEKDAY_LABELS.map((day, i) => (
              <div
                key={day.short}
                className={cn(
                  'rounded-md px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]',
                  i >= 5 && 'text-muted-foreground/80',
                )}
              >
                <span className="sm:hidden">{day.short}</span>
                <span className="hidden sm:inline">{day.long}</span>
              </div>
            ))}
        </div>

        <div className="mt-1 space-y-1 sm:mt-1.5 sm:space-y-1.5">
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid gap-1 sm:gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {week.map((date) => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  month={month}
                  events={events}
                  viewMode={viewMode}
                  onDayClick={onDayClick}
                  onEventClick={onEventClick}
                  onEventDrop={onEventDrop}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
