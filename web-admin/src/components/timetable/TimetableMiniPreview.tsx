'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { entryCellColor } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

export function TimetableMiniPreview({
  title,
  subtitle,
  entries,
  workDays,
  maxLesson,
  compact = false,
  className,
}: {
  title: string;
  subtitle?: string;
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
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
      m.set(`${e.day_of_week}-${e.lesson_num}`, e);
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
                  const e = byKey.get(`${d}-${ln}`);
                  return (
                    <td key={d} className="min-w-[28px] border border-border/40 p-px align-middle">
                      {e ? (
                        <div
                          className="truncate rounded px-0.5 py-px text-center font-medium leading-tight text-white shadow-sm"
                          style={entryCellColor(e, 'class')}
                          title={`${e.subject} · ${e.class_section}`}
                        >
                          {e.subject.slice(0, compact ? 3 : 5)}
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
