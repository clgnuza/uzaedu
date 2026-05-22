'use client';

import { useMemo } from 'react';
import { TimetableGrid } from './TimetableGrid';
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
}: {
  entries: Row[];
  classSection?: string;
  workDays?: number[];
  maxLesson?: number;
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

  return (
    <TimetableGrid
      entries={mapped}
      workDays={workDays}
      maxLesson={max}
      lessonSchedule={[]}
      editable={false}
      busy
      clashIds={new Set()}
      onMove={() => {}}
      onEditEntry={() => {}}
    />
  );
}
