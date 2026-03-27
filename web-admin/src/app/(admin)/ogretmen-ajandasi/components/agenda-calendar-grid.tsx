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
import { cn } from '@/lib/utils';

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

const SOURCE_COLORS: Record<string, string> = {
  PERSONAL: 'bg-primary/12 border-l-4 border-l-primary rounded-lg',
  SCHOOL: 'bg-blue-500/12 border-l-4 border-l-blue-500 rounded-lg',
  PLATFORM: 'bg-amber-500/12 border-l-4 border-l-amber-500 rounded-lg',
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
  const dayLabels = viewMode === 'day' ? [format(month, 'd MMMM yyyy')] : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div className="table-x-scroll -mx-1">
      <div className="min-w-[280px] rounded-xl overflow-hidden border border-border/60 bg-card">
        <div className={`grid border-b-2 border-border/60 bg-muted/40 text-center text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {dayLabels.map((day) => (
            <div key={day} className="py-3 sm:py-3.5 border-r border-border/40 last:border-r-0 min-w-0">
              {day}
            </div>
          ))}
        </div>
        <div className="divide-y divide-border/40">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {week.map((date) => {
                const dayEvents = getEventsForDay(events, date);
                const isCurrentMonth = isSameMonth(date, month);
                const isToday = isSameDay(date, new Date());
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'min-h-[100px] sm:min-h-[120px] border-r border-border/40 p-1.5 sm:p-2 last:border-r-0 min-w-0 cursor-pointer transition-all duration-200 touch-manipulation',
                      'hover:bg-primary/5 active:bg-primary/10',
                      !isCurrentMonth && 'bg-muted/5',
                    )}
                    onClick={() => onDayClick?.(date)}
                    onDragOver={(e) => { e.preventDefault(); if (onEventDrop) e.dataTransfer.dropEffect = 'move'; }}
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
                        'inline-flex size-8 sm:size-9 items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0',
                        isToday && 'bg-primary text-primary-foreground shadow-md',
                        isCurrentMonth && !isToday && 'text-foreground hover:bg-muted/50',
                        !isCurrentMonth && 'text-muted-foreground/60',
                      )}
                    >
                      {format(date, 'd')}
                    </span>
                    <div className="mt-1.5 space-y-1 overflow-y-auto max-h-[120px] sm:max-h-[140px] min-h-[28px] scrollbar-none">
                      {dayEvents.map((ev) => (
                        <button
                          key={`${ev.type}-${ev.id}`}
                          type="button"
                          draggable={ev.type === 'task' && !!onEventDrop}
                          onDragStart={(e) => { if (ev.type === 'task' && onEventDrop) e.dataTransfer.setData('text/event-id', ev.id); }}
                          className={cn(
                            'w-full text-left rounded-lg px-2 py-1.5 transition-all hover:opacity-95 min-h-[26px] touch-manipulation flex flex-col gap-0.5',
                            SOURCE_COLORS[ev.source] ?? 'bg-muted/40 border-l-4 border-l-muted-foreground rounded-lg',
                            ev.type === 'task' && onEventDrop && 'cursor-grab active:cursor-grabbing',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(ev);
                          }}
                          title={`${ev.title}${ev.createdBy ? ` • ${ev.createdBy}` : ''}${ev.type === 'task' && onEventDrop ? ' (sürükleyerek tarih değiştir)' : ''}`}
                        >
                          <span className="text-[10px] sm:text-xs font-medium truncate leading-tight">
                            {TYPE_ICONS[ev.type] && <span className="mr-1">{TYPE_ICONS[ev.type]}</span>}
                            {ev.title}
                          </span>
                          {ev.createdBy && (
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
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
