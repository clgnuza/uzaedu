import { maxLessonsOnDay, type LongBreakDef } from '@/lib/timetable-grid-build';

export type SlotClosureReason = 'teacher_unavailable' | 'blocked_lesson' | 'day_limit';

export type SlotClosure = {
  reason: SlotClosureReason;
  label: string;
};

export type GridMetaForClosures = {
  blocked_lesson_nums: number[];
  long_breaks?: LongBreakDef[];
  lessons_per_day_by_dow: Record<string, number>;
};

/** Kapalı / bırakılamaz hücreler (gün–ders anahtarı: `1-3`). */
export function buildSlotClosures(
  workDays: number[],
  maxLesson: number,
  gridMeta: GridMetaForClosures | undefined,
  teacherUnavailable: Array<{ day_of_week: number; lesson_num?: number }> | undefined,
): Map<string, SlotClosure> {
  const map = new Map<string, SlotClosure>();

  for (const lesson of gridMeta?.blocked_lesson_nums ?? []) {
    for (const day of workDays) {
      map.set(`${day}-${lesson}`, {
        reason: 'blocked_lesson',
        label: 'Kapalı ders saati (dönem ayarı)',
      });
    }
  }

  for (const day of workDays) {
    const dayMax = maxLessonsOnDay(day, maxLesson, gridMeta?.lessons_per_day_by_dow ?? {});
    for (let lesson = dayMax + 1; lesson <= maxLesson; lesson++) {
      map.set(`${day}-${lesson}`, {
        reason: 'day_limit',
        label: 'Bu gün için ders saati yok',
      });
    }
  }

  for (const p of teacherUnavailable ?? []) {
    if (p.lesson_num != null) {
      map.set(`${p.day_of_week}-${p.lesson_num}`, {
        reason: 'teacher_unavailable',
        label: 'Öğretmen bu saatte müsait değil',
      });
    } else {
      for (let lesson = 1; lesson <= maxLesson; lesson++) {
        map.set(`${p.day_of_week}-${lesson}`, {
          reason: 'teacher_unavailable',
          label: 'Öğretmen bu gün müsait değil',
        });
      }
    }
  }

  return map;
}

export function closureAt(
  closures: Map<string, SlotClosure>,
  day: number,
  lesson: number,
): SlotClosure | undefined {
  return closures.get(`${day}-${lesson}`);
}
