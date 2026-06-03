'use client';

import { useMemo, type RefObject } from 'react';
import { TimetableGrid } from './TimetableGrid';
import type { MatrixAxis } from './TimetableMatrixGrid';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function TimetableReadonly({
  entries,
  classSection,
  teacherId,
  workDays = [1, 2, 3, 4, 5],
  maxLesson = 8,
  displayMode = 'class',
  placementMode = 'drag',
  focusEntryIds,
  gridRef,
}: {
  entries: EditorEntry[];
  classSection?: string;
  teacherId?: string;
  workDays?: number[];
  maxLesson?: number;
  displayMode?: 'class' | 'teacher' | 'room' | 'all';
  /** false = geniş kart (öğretmen satırı); üretim önizlemesi için click */
  placementMode?: 'drag' | 'click';
  focusEntryIds?: Set<string> | null;
  gridRef?: RefObject<HTMLDivElement | null>;
}) {
  const mapped = useMemo(() => {
    let filtered = entries;
    if (classSection) filtered = filtered.filter((e) => e.class_section === classSection);
    if (teacherId) filtered = filtered.filter((e) => e.user_id === teacherId);
    return filtered.map((e, i) => ({
      ...e,
      id: e.id || `ro-${i}-${e.day_of_week}-${e.lesson_num}-${e.class_section}`,
    }));
  }, [entries, classSection, teacherId]);

  const max = Math.max(maxLesson, ...mapped.map((e) => e.lesson_num), 1);

  const effectiveDisplay = teacherId ? 'teacher' : displayMode;

  const matrixAxis: MatrixAxis | undefined =
    classSection || teacherId
      ? undefined
      : effectiveDisplay === 'all' || effectiveDisplay === 'teacher' || effectiveDisplay === 'room' || effectiveDisplay === 'class'
        ? effectiveDisplay === 'all'
          ? 'teacher'
          : effectiveDisplay
        : 'teacher';

  const classSections = useMemo(() => {
    const s = new Set<string>();
    for (const e of mapped) {
      const c = e.class_section.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  }, [mapped]);

  return (
    <div ref={gridRef} className="min-h-0">
      <TimetableGrid
        entries={mapped}
        workDays={workDays}
        maxLesson={max}
        lessonSchedule={[]}
        displayMode={effectiveDisplay}
        matrixAxis={matrixAxis}
        classSections={classSections}
        editable={false}
        busy
        placementMode={placementMode}
        clashIds={new Set()}
        focusEntryIds={focusEntryIds}
        dimUnfocusedEntries={!!focusEntryIds?.size}
        onMove={() => {}}
        onEditEntry={() => {}}
      />
    </div>
  );
}
