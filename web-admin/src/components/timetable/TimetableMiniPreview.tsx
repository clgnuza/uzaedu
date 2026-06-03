'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { entryCellColor, entryCellInlineStyle, entryShortCode } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function slotKey(day: number, lesson: number): string {
  return `${Number(day)}-${Number(lesson)}`;
}

function miniCellLabel(e: EditorEntry, view: 'class' | 'teacher' | 'room', compact: boolean): string {
  const max = compact ? 4 : 6;
  if (view === 'teacher' || view === 'room') {
    const sec = e.class_section?.trim();
    if (sec) return sec.length > max ? `${sec.slice(0, max - 1)}…` : sec;
  }
  const sub = e.subject?.trim();
  if (sub) return sub.length > max ? `${sub.slice(0, max - 1)}…` : sub;
  return entryShortCode(e).slice(0, max);
}

export function TimetableMiniPreview({
  title,
  subtitle,
  entries,
  workDays,
  maxLesson,
  viewMode = 'class',
  compact = false,
  className,
}: {
  title: string;
  subtitle?: string;
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
  viewMode?: 'class' | 'teacher' | 'room';
  compact?: boolean;
  className?: string;
}) {
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const lessons = useMemo(
    () => Array.from({ length: Math.min(maxLesson, compact ? 8 : 10) }, (_, i) => i + 1),
    [maxLesson, compact],
  );

  const byKey = useMemo(() => {
    const m = new Map<string, EditorEntry>();
    for (const e of entries) {
      m.set(slotKey(e.day_of_week, e.lesson_num), e);
    }
    return m;
  }, [entries]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border/80 bg-gradient-to-b from-card to-muted/30 shadow-sm',
        className,
      )}
    >
      <div className="border-b border-border/60 bg-muted/40 px-2.5 py-1.5">
        <p className="truncate text-[11px] font-semibold text-foreground">{title}</p>
        {subtitle ? <p className="truncate text-[9px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="overflow-x-auto p-1.5">
        <table className="w-full min-w-[200px] border-collapse text-[8px]">
          <thead>
            <tr>
              <th className="w-6 border border-border/50 bg-muted/50 p-0.5 font-medium text-muted-foreground" />
              {days.map((d) => (
                <th
                  key={d}
                  className="border border-border/50 bg-muted/50 p-0.5 font-semibold text-muted-foreground"
                >
                  {DAY_SHORT[d - 1] ?? dayLabel(d).slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lessons.map((ln) => (
              <tr key={ln}>
                <td className="border border-border/50 bg-muted/30 p-0.5 text-center tabular-nums text-muted-foreground">
                  {ln}
                </td>
                {days.map((d) => {
                  const e = byKey.get(slotKey(d, ln));
                  const colors = e ? entryCellColor(e, viewMode) : null;
                  return (
                    <td key={d} className="min-w-[28px] border border-border/40 p-px align-middle">
                      {e && colors ? (
                        <div
                          className="truncate rounded px-0.5 py-px text-center font-semibold leading-tight shadow-sm"
                          style={entryCellInlineStyle(colors)}
                          title={[e.subject, e.class_section, e.teacher_label, e.room_name]
                            .filter(Boolean)
                            .join(' · ')}
                        >
                          {miniCellLabel(e, viewMode, compact)}
                        </div>
                      ) : (
                        <span className="block py-0.5 text-center text-muted-foreground/25">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
