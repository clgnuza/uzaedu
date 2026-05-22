export type LongBreakDef = { after_lesson: number; label?: string; blocked_slots?: number };

export type GridRow =
  | { kind: 'lesson'; lessonNum: number }
  | { kind: 'lunch'; label: string; afterLesson: number };

/** Her ders sırası + varsa sonrasında öğle (ders sayısını düşürmez). */
export function buildTimetableRows(maxLesson: number, longBreaks: LongBreakDef[]): GridRow[] {
  const rows: GridRow[] = [];
  for (let lesson = 1; lesson <= maxLesson; lesson++) {
    rows.push({ kind: 'lesson', lessonNum: lesson });
    const br = longBreaks.find((b) => b.after_lesson === lesson);
    if (br) {
      rows.push({ kind: 'lunch', label: br.label ?? 'Öğle tatili', afterLesson: lesson });
    }
  }
  return rows;
}

export function buildForbiddenSlots(
  workDays: number[],
  maxLesson: number,
  teacherUnavailable: Array<{ day_of_week: number; lesson_num?: number }> | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const p of teacherUnavailable ?? []) {
    if (p.lesson_num != null) {
      set.add(`${p.day_of_week}-${p.lesson_num}`);
    } else {
      for (let l = 1; l <= maxLesson; l++) set.add(`${p.day_of_week}-${l}`);
    }
  }
  return set;
}

export function maxLessonsOnDay(
  day: number,
  defaultMax: number,
  lessonsPerDayByDow: Record<string, number>,
): number {
  const v = lessonsPerDayByDow[String(day)];
  return v != null && v >= 1 ? Math.min(defaultMax, v) : defaultMax;
}

export function scheduleForDay(
  day: number,
  weekday: Array<{ lesson_num: number; start_time: string; end_time: string }>,
  weekend?: Array<{ lesson_num: number; start_time: string; end_time: string }> | null,
) {
  if (day >= 6 && weekend?.length) return weekend;
  return weekday;
}

export function slotHighlightKey(day: number, lesson: number) {
  return `slot-${day}-${lesson}`;
}
