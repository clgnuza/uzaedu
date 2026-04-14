'use client';

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

const TYPE_ICONS: Record<string, string> = {
  note: '📝',
  task: '✓',
  school_event: '🏫',
  platform_event: '📢',
  duty: '🛡',
  exam_duty: '📋',
  student_note: '👤',
  parent_meeting: '👨‍👩‍👧',
  belirli_gun_hafta: '📅',
  timetable: '📚',
};

function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const ymd = format(date, 'yyyy-MM-dd');
  return events.filter((ev) => ev.start.slice(0, 10) === ymd);
}

function isWeekendMonSun(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
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
  const weeks = viewMode === 'day'
    ? [days]
    : Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
        days.slice(i * 7, (i + 1) * 7),
      );

  const cols = viewMode === 'day' ? 1 : 7;
  const weekdayKeys = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

  return (
    <div className="table-x-scroll -mx-0.5 sm:mx-0">
      <div className="min-w-[min(100%,280px)] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(15,23,42,0.12)] ring-1 ring-black/3 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-white/6">
        <div
          className="grid border-b border-border/60 bg-linear-to-b from-muted/80 to-muted/45 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[11px]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {viewMode === 'day' ? (
            <div className="min-w-0 border-r border-border/50 py-2.5 last:border-r-0 sm:py-3 normal-case tracking-normal">
              <span className="sm:hidden tabular-nums">{format(month, 'dd/MM/yyyy')}</span>
              <span className="hidden sm:inline">{format(month, 'd MMMM yyyy', { locale: tr })}</span>
            </div>
          ) : (
            weekdayKeys.map((day) => (
              <div key={day} className="min-w-0 border-r border-border/50 py-2.5 last:border-r-0 sm:py-3">
                {day}
              </div>
            ))
          )}
        </div>
        <div className="divide-y divide-border/50 bg-linear-to-b from-card to-muted/15">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {week.map((date) => {
                const dayEvents = getEventsForDay(events, date);
                const isCurrentMonth = isSameMonth(date, month);
                const isToday = isSameDay(date, new Date());
                const weekend = isWeekendMonSun(date);
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'min-h-[84px] min-w-0 cursor-pointer border-r border-border/40 p-1 transition-colors duration-200 last:border-r-0 touch-manipulation sm:min-h-[104px] sm:p-1.5 md:min-h-[128px] md:p-2',
                      'hover:bg-muted/30 active:bg-muted/45',
                      weekend && 'bg-slate-500/4 dark:bg-slate-400/6',
                      !isCurrentMonth && 'opacity-[0.72]',
                      isToday && 'bg-primary/6 ring-1 ring-inset ring-primary/30 dark:bg-primary/10',
                    )}
                    onClick={() => onDayClick?.(date)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (onEventDrop) e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/event-id');
                      if (id && onEventDrop) onEventDrop(id, format(date, 'yyyy-MM-dd'));
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onDayClick?.(date)}
                  >
                    <span
                      className={cn(
                        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors sm:size-7 sm:rounded-lg sm:text-[11px] md:size-8 md:text-sm',
                        isToday &&
                          'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/20 ring-offset-2 ring-offset-background',
                        isCurrentMonth && !isToday && 'text-foreground bg-background/80 ring-1 ring-border/50',
                        !isCurrentMonth && 'text-muted-foreground bg-muted/30',
                      )}
                    >
                      {format(date, 'd')}
                    </span>
                    <div className="mt-1 max-h-[92px] min-h-[28px] space-y-0.5 overflow-y-auto [-webkit-overflow-scrolling:touch] scrollbar-none sm:mt-1.5 sm:max-h-[118px] sm:min-h-[32px] sm:space-y-1 md:max-h-[138px]">
                      {dayEvents.map((ev) => (
                        <button
                          key={`${ev.type}-${ev.id}`}
                          type="button"
                          draggable={ev.type === 'task' && !!onEventDrop && !String(ev.id).includes('~')}
                          onDragStart={(e) => {
                            if (ev.type === 'task' && onEventDrop && !String(ev.id).includes('~'))
                              e.dataTransfer.setData('text/event-id', ev.id);
                          }}
                          className={cn(
                            'flex w-full min-h-[24px] flex-col gap-0 rounded-md px-1 py-0.5 text-left transition-transform hover:brightness-[1.02] active:scale-[0.99] touch-manipulation sm:min-h-[30px] sm:gap-0.5 sm:rounded-lg sm:px-2 sm:py-1.5 md:min-h-[34px] md:py-2',
                            agendaEventChipClassForEvent(ev),
                            ev.type === 'task' && onEventDrop && !String(ev.id).includes('~') && 'cursor-grab active:cursor-grabbing',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(ev);
                          }}
                          title={`${ev.title}${ev.createdBy ? ` • ${ev.createdBy}` : ''}${ev.type === 'task' && onEventDrop && !String(ev.id).includes('~') ? ' (sürükleyerek tarih değiştir)' : ''}`}
                        >
                          <span className="line-clamp-1 text-[9px] font-semibold leading-tight sm:line-clamp-2 sm:text-[11px] sm:leading-snug md:text-xs md:leading-tight">
                            {TYPE_ICONS[ev.type] && <span className="mr-0.5 opacity-90">{TYPE_ICONS[ev.type]}</span>}
                            {ev.title}
                          </span>
                          {ev.createdBy && (
                            <span className="line-clamp-1 text-[8px] font-medium opacity-85 max-sm:hidden sm:text-[9px] md:text-[10px]">
                              {ev.createdBy}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
