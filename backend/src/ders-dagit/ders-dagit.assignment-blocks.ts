import {
  assignmentDayDistribution,
  isValidDayDistribution,
} from './ders-dagit.day-distribution';
import { assignmentBlockLessons } from './ders-dagit.school-profile';

export type AssignmentPlacementSpec = {
  block_size: number;
  max_per_day: number;
  day_distribution: number[] | null;
};

type SlotEntry = {
  id?: string;
  assignment_id?: string | null;
  day_of_week: number;
  lesson_num: number;
};

/** Atama kartı / haftalık dağılımdan gerekli ardışık blok boyutu (stüdyo kuralı şart değil). */
export function assignmentPlacementSpec(
  options?: Record<string, unknown>,
  weeklyHours?: number,
  biweekly?: boolean,
): AssignmentPlacementSpec {
  const eff =
    weeklyHours != null ? (biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours) : 0;
  const distRaw = assignmentDayDistribution(options);
  const dist =
    distRaw && eff > 0 && isValidDayDistribution(distRaw, eff) ? distRaw : distRaw?.length ? distRaw : null;
  const blockFromOpt = assignmentBlockLessons(options);
  const blockFromDist = dist?.length ? Math.max(...dist) : 0;
  const block_size = blockFromOpt >= 2 ? blockFromOpt : blockFromDist >= 2 ? blockFromDist : 0;
  const max_per_day = dist?.length ? Math.max(...dist) : block_size >= 2 ? block_size : 8;
  return { block_size, max_per_day, day_distribution: dist };
}

export function lessonsOnDayConsecutive(lessonNums: number[]): boolean {
  if (lessonNums.length <= 1) return true;
  const s = [...lessonNums].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) {
    if (s[i]! !== s[i - 1]! + 1) return false;
  }
  return true;
}

function uniqueDayLessons(lessonNums: number[]): number[] {
  return [...new Set(lessonNums)].sort((a, b) => a - b);
}

function projectedDayLessons(
  entries: SlotEntry[],
  assignmentId: string,
  day: number,
  excludeEntryId: string | undefined,
  addLesson: number,
): number[] {
  const lessons = entries
    .filter(
      (e) =>
        e.assignment_id === assignmentId &&
        e.day_of_week === day &&
        e.id !== excludeEntryId,
    )
    .map((e) => e.lesson_num);
  lessons.push(addLesson);
  return uniqueDayLessons(lessons);
}

/** Yerleşim / taşıma: aynı atamada aynı günde dersler ardışık ve günlük tavan aşılmamalı. */
export function assignmentBlockPlacementOk(
  entries: SlotEntry[],
  assignmentId: string,
  entryId: string | undefined,
  day: number,
  lesson: number,
  spec: AssignmentPlacementSpec,
): boolean {
  const lessons = projectedDayLessons(entries, assignmentId, day, entryId, lesson);
  if (lessons.length > spec.max_per_day) return false;
  if (spec.block_size >= 2 || lessons.length >= 2) {
    return lessonsOnDayConsecutive(lessons);
  }
  return true;
}

export function assignmentBlockPlacementOkForAssignment(
  entries: SlotEntry[],
  assignmentId: string,
  spec: AssignmentPlacementSpec,
): boolean {
  const byDay = new Map<number, number[]>();
  for (const e of entries) {
    if (e.assignment_id !== assignmentId) continue;
    const arr = byDay.get(e.day_of_week) ?? [];
    arr.push(e.lesson_num);
    byDay.set(e.day_of_week, arr);
  }
  for (const lessons of byDay.values()) {
    const unique = uniqueDayLessons(lessons);
    if (unique.length > spec.max_per_day) return false;
    if (spec.block_size >= 2 || unique.length >= 2) {
      if (!lessonsOnDayConsecutive(unique)) return false;
    }
  }
  return true;
}
