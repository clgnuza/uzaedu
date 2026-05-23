'use client';

import { useMemo } from 'react';
import { TimetableGrid } from './TimetableGrid';
import type { MatrixAxis } from './TimetableMatrixGrid';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

type Row = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  teacher_label?: string | null;
  room_name?: string | null;
};

export function TimetableReadonly({
  entries,
  classSection,
  workDays = [1, 2, 3, 4, 5],
  maxLesson = 8,
  displayMode = 'all',
}: {
  entries: Row[];
  classSection?: string;
  workDays?: number[];
  maxLesson?: number;
  displayMode?: 'class' | 'teacher' | 'room' | 'all';
}) {
  const mapped: EditorEntry[] = useMemo(() => {
    const filtered = classSection ? entries.filter((e) => e.class_section === classSection) : entries;
    return filtered.map((e, i) => ({
      id: `ro-${i}-${e.day_of_week}-${e.lesson_num}-${e.class_section}`,
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      subject: e.subject,
      teacher_label: e.teacher_label,
      room_name: e.room_name,
    }));
  }, [entries, classSection]);

  const max = Math.max(maxLesson, ...mapped.map((e) => e.lesson_num), 1);

  const matrixAxis: MatrixAxis | undefined = classSection
    ? undefined
    : displayMode === 'all' || displayMode === 'teacher' || displayMode === 'room' || displayMode === 'class'
      ? displayMode === 'all'
        ? 'teacher'
        : displayMode
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
    <TimetableGrid
      entries={mapped}
      workDays={workDays}
      maxLesson={max}
      lessonSchedule={[]}
      displayMode={displayMode}
      matrixAxis={matrixAxis}
      classSections={classSections}
      editable={false}
      busy
      clashIds={new Set()}
      onMove={() => {}}
      onEditEntry={() => {}}
    />
  );
}
