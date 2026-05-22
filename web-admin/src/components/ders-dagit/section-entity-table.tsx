'use client';

import { useMemo } from 'react';
import { DdMiniWeekGrid } from '@/components/ders-dagit/dd-mini-week-grid';
import { countSectionSlots, emptySchedule, type LongBreakDef, type SectionScheduleConfig } from '@/lib/section-schedule';
import { GraduationCap } from 'lucide-react';
import { sortClassSections } from '@/lib/class-section-sort';
import { cn } from '@/lib/utils';

type Props = {
  sections: string[];
  schedules: Record<string, SectionScheduleConfig>;
  activeSection: string | null;
  workDays: number[];
  schoolMaxLessons: number;
  studioLessonsByDow?: Record<string, number>;
  longBreaks?: LongBreakDef[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (section: string) => void;
  onTimeTableClick?: (section: string) => void;
};

export function SectionEntityTable({
  sections,
  schedules,
  activeSection,
  workDays,
  schoolMaxLessons,
  studioLessonsByDow,
  longBreaks,
  query,
  onQueryChange,
  onSelect,
  onTimeTableClick,
}: Props) {
  const ordered = useMemo(() => sortClassSections(sections), [sections]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return ordered;
    return ordered.filter((s) => s.toLocaleLowerCase('tr').includes(q));
  }, [ordered, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <input
          type="search"
          placeholder="Bul: şube…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full max-w-xs rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground shadow-sm">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-2 py-2">Adı</th>
            <th className="hidden px-2 py-2 sm:table-cell">Kısa</th>
            <th className="px-2 py-2 text-right">Müsait slot</th>
            <th className="px-2 py-2">Zaman</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((sec) => {
            const active = sec === activeSection;
            const sched = schedules[sec] ?? emptySchedule();
            const slotCounts = countSectionSlots(sched, workDays, schoolMaxLessons, studioLessonsByDow, longBreaks);
            return (
              <tr
                key={sec}
                className={cn('cursor-pointer border-t hover:bg-muted/40', active && 'bg-primary/10')}
                onClick={() => onSelect(sec)}
              >
                <td className="px-2 py-1.5">
                  <GraduationCap className="size-4 text-violet-600" aria-hidden />
                </td>
                <td className="px-2 py-1.5 font-medium">{sec}</td>
                <td className="hidden px-2 py-1.5 text-muted-foreground sm:table-cell">{sec}</td>
                <td
                  className="px-2 py-1.5 text-right tabular-nums"
                  title={`${slotCounts.placeable} müsait · ${slotCounts.closed} kapalı (K) · ${slotCounts.lessonCells} ders hücresi`}
                >
                  <span className={slotCounts.closed > 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                    {slotCounts.placeable}
                  </span>
                  {slotCounts.closed > 0 ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">/ {slotCounts.lessonCells}</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    className="rounded border border-transparent p-0.5 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                    title="Zaman tablosunu aç"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimeTableClick?.(sec);
                    }}
                  >
                    <DdMiniWeekGrid
                      key={`${sec}-${slotCounts.placeable}-${slotCounts.closed}-${JSON.stringify(sched.cells)}`}
                      mode="section"
                      workDays={workDays}
                      maxLessons={schoolMaxLessons}
                      schedule={sched}
                      longBreaks={longBreaks}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
