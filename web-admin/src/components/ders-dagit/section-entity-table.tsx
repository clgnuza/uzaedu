'use client';

import { useMemo } from 'react';
import { DdMiniWeekGrid } from '@/components/ders-dagit/dd-mini-week-grid';
import { countSectionSlots, emptySchedule, type LongBreakDef, type SectionScheduleConfig } from '@/lib/section-schedule';
import { GraduationCap } from 'lucide-react';
import { DdEntityTableShell, ddEntityRowClass } from '@/components/ders-dagit/dd-entity-table-shell';
import { sortClassSections } from '@/lib/class-section-sort';
import type { SectionAssignmentStatus } from '@/lib/assigned-lessons-summary';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<SectionAssignmentStatus['tone'], string> = {
  ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  warn: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
  error: 'bg-destructive/15 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

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
  assignmentStatusBySection?: Record<string, SectionAssignmentStatus>;
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
  assignmentStatusBySection,
}: Props) {
  const ordered = useMemo(() => sortClassSections(sections), [sections]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return ordered;
    return ordered.filter((s) => s.toLocaleLowerCase('tr').includes(q));
  }, [ordered, query]);

  return (
    <DdEntityTableShell placeholder="Bul: şube…" query={query} onQueryChange={onQueryChange}>
      <table className="dd-entity-table min-w-[40rem]">
        <thead className="dd-entity-thead">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="px-2 py-2">Şube</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Atanan</th>
            <th className="px-2 py-2 whitespace-nowrap">Durum</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Müsait slot</th>
            <th className="px-2 py-2">Zaman</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((sec) => {
            const active = sec === activeSection;
            const sched = schedules[sec] ?? emptySchedule();
            const slotCounts = countSectionSlots(sched, workDays, schoolMaxLessons, studioLessonsByDow, longBreaks);
            const assign = assignmentStatusBySection?.[sec];
            return (
              <tr
                key={sec}
                className={ddEntityRowClass(
                  active,
                  assign?.tone === 'error' ? 'dd-entity-row-warn' : undefined,
                )}
                onClick={() => onSelect(sec)}
              >
                <td>
                  <span className="dd-entity-row-icon dd-entity-row-icon-violet">
                    <GraduationCap className="size-3.5" aria-hidden />
                  </span>
                </td>
                <td className="max-w-[14rem] truncate px-2 py-1.5 font-medium" title={sec}>
                  {sec}
                </td>
                <td
                  className="px-2 py-1.5 text-right tabular-nums text-xs"
                  title={assign?.title}
                >
                  {assign ? (
                    <>
                      <span
                        className={cn(
                          'font-semibold',
                          assign.tone === 'error' && 'text-destructive',
                        )}
                      >
                        {assign.assignedHours}
                      </span>
                      {assign.weeklyLimit != null ? (
                        <span className="text-muted-foreground"> / {assign.weeklyLimit}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {assign && assign.label !== '—' ? (
                    <span
                      className={cn(
                        'dd-entity-status max-w-[7rem] truncate',
                        STATUS_BADGE[assign.tone],
                      )}
                      title={assign.title}
                    >
                      {assign.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
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
    </DdEntityTableShell>
  );
}
