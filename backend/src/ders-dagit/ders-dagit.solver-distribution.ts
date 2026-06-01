import {
  assignmentDayDistribution,
  isValidDayDistribution,
} from './ders-dagit.day-distribution';
import { assignmentBlockLessons } from './ders-dagit.school-profile';
import { daysForAssignment } from './ders-dagit.solver-blocks';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

export type PlaceOneFn = (
  a: SolverAssignment,
  classSection: string,
  day: number,
  lesson: number,
  userId: string | null,
) => boolean;

function countOnDay(entries: SolverSlot[], assignmentId: string, day: number): number {
  return entries.filter((e) => e.assignment_id === assignmentId && e.day_of_week === day).length;
}

function canPlaceChunk(
  occupied: Map<string, SolverSlot[]>,
  a: SolverAssignment,
  day: number,
  start: number,
  chunkSize: number,
  uid: string | null,
  ctx: SolverContext,
  canPlace: (
    occupied: Map<string, SolverSlot[]>,
    day: number,
    lesson: number,
    classSection: string,
    userId: string | null,
    ctx: SolverContext,
    a: SolverAssignment,
  ) => boolean,
): boolean {
  const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  if (start + chunkSize - 1 > dayMax) return false;
  for (let i = 0; i < chunkSize; i++) {
    const lesson = start + i;
    if (ctx.blocked_lesson_nums.has(lesson)) return false;
    for (const sec of a.class_sections) {
      if (!canPlace(occupied, day, lesson, sec, uid, ctx, a)) return false;
    }
  }
  return true;
}

/** Gün başına pattern[] ile yerleştir (ör. [2,2], [3,1]) */
export function placeByDayDistribution(
  a: SolverAssignment,
  need: number,
  pattern: number[],
  uid: string | null,
  workDays: number[],
  ctx: SolverContext,
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  placeOne: PlaceOneFn,
  canPlace: (
    occupied: Map<string, SolverSlot[]>,
    day: number,
    lesson: number,
    classSection: string,
    userId: string | null,
    ctx: SolverContext,
    a: SolverAssignment,
  ) => boolean,
): number {
  if (!isValidDayDistribution(pattern, need)) return 0;

  const dayList = daysForAssignment(a, workDays);
  let placed = 0;
  const usedDays = new Set<number>();

  const dayOrder = (day: number) => {
    const on = countOnDay(entries, a.id, day);
    const newDay = usedDays.has(day) ? 10 : 0;
    return on * 5 + newDay;
  };

  for (const chunk of pattern) {
    if (placed >= need) break;
    const chunkSize = Math.min(chunk, need - placed);
    const sortedDays = [...dayList].sort((x, y) => dayOrder(x) - dayOrder(y));
    let chunkDone = false;

    for (const day of sortedDays) {
      if (chunkDone) break;
      if (a.max_per_day != null && countOnDay(entries, a.id, day) + chunkSize > a.max_per_day) continue;

      const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
      const starts =
        chunkSize >= 2
          ? Array.from({ length: Math.max(0, dayMax - chunkSize + 1) }, (_, i) => i + 1)
          : Array.from({ length: dayMax }, (_, i) => dayMax - i);

      for (const start of starts) {
        if (ctx.blocked_lesson_nums.has(start)) continue;
        if (!canPlaceChunk(occupied, a, day, start, chunkSize, uid, ctx, canPlace)) continue;
        for (let i = 0; i < chunkSize; i++) {
          for (const sec of a.class_sections) {
            if (placeOne(a, sec, day, start + i, uid)) placed += 1;
          }
        }
        usedDays.add(day);
        chunkDone = true;
        break;
      }
    }
    if (!chunkDone) return placed;
  }
  return placed;
}

export function effectivePatternForAssignment(a: SolverAssignment, need: number): number[] | null {
  const raw = assignmentDayDistribution(a.options);
  if (raw && isValidDayDistribution(raw, need)) return raw;
  const block = assignmentBlockLessons(a.options);
  if (block >= 2 && need === block * 2) return [block, block];
  return null;
}
