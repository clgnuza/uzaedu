import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';
import { assignmentBlockLessons, assignmentPlaceOnDays } from './ders-dagit.school-profile';

export type PlaceOneFn = (
  a: SolverAssignment,
  classSection: string,
  day: number,
  lesson: number,
  userId: string | null,
) => boolean;

/** MTAL vb. — sadece izin verilen günler */
export function daysForAssignment(a: SolverAssignment, workDays: number[]): number[] {
  const only = assignmentPlaceOnDays(a.options);
  if (!only?.length) return workDays;
  return workDays.filter((d) => only.includes(d));
}

/** Ardışık blok yerleştir (block_lessons) */
export function tryPlaceLessonBlock(
  a: SolverAssignment,
  classSection: string,
  day: number,
  startLesson: number,
  blockSize: number,
  userId: string | null,
  ctx: SolverContext,
  placeOne: PlaceOneFn,
): boolean {
  for (let i = 0; i < blockSize; i++) {
    const lesson = startLesson + i;
    const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
    if (lesson > dayMax || ctx.blocked_lesson_nums.has(lesson)) return false;
    if (!placeOne(a, classSection, day, lesson, userId)) return false;
  }
  return true;
}

export function placeAssignmentWithBlocks(
  a: SolverAssignment,
  uid: string | null,
  days: number[],
  need: number,
  ctx: SolverContext,
  entries: SolverSlot[],
  countOnDay: (assignmentId: string, day: number) => number,
  placeOne: PlaceOneFn,
): number {
  const blockSize = assignmentBlockLessons(a.options);
  const dayList = daysForAssignment(a, days);
  if (blockSize > 1) {
    let placed = 0;
    outer: for (const day of dayList) {
      const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
      for (let start = 1; start <= dayMax - blockSize + 1; start++) {
        if (ctx.blocked_lesson_nums.has(start)) continue;
        for (const sec of a.class_sections) {
          const chunk = Math.min(blockSize, need - placed);
          if (chunk < blockSize) break outer;
          if (a.max_per_day != null && countOnDay(a.id, day) + chunk > a.max_per_day) continue;
          if (tryPlaceLessonBlock(a, sec, day, start, chunk, uid, ctx, placeOne)) {
            placed += chunk;
            if (placed >= need) return placed;
          }
        }
      }
    }
    return placed;
  }
  return 0;
}
