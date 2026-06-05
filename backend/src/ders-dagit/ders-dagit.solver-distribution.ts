import {
  assignmentDayDistribution,
  distinctPatternPermutations,
  inferDayDistribution,
  isValidDayDistribution,
  remainingPatternChunks,
} from './ders-dagit.day-distribution';
import { shouldEnforceDistributionPattern } from './ders-dagit.distribution-policy';
import { assignmentBlockLessons } from './ders-dagit.school-profile';
import { daysForAssignment } from './ders-dagit.solver-blocks';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

export type CanPlaceFn = (
  occupied: Map<string, SolverSlot[]>,
  day: number,
  lesson: number,
  classSection: string,
  userId: string | null,
  ctx: SolverContext,
  a: SolverAssignment,
) => boolean;

export type PlaceOneFn = (
  a: SolverAssignment,
  classSection: string,
  day: number,
  lesson: number,
  userId: string | null,
) => boolean;

function countOnDay(entries: SolverSlot[], assignmentId: string, day: number): number {
  const lessons = new Set<number>();
  for (const e of entries) {
    if (e.assignment_id === assignmentId && e.day_of_week === day) lessons.add(e.lesson_num);
  }
  return lessons.size;
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
  canPlace: CanPlaceFn,
  totalWeeklyHours?: number,
): number {
  const total = totalWeeklyHours ?? need;
  if (!isValidDayDistribution(pattern, total)) return 0;

  const snap = snapshotPlacement(entries, occupied);
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
    if (!chunkDone) {
      restorePlacement(entries, occupied, snap);
      return 0;
    }
  }
  return placed;
}

type PlacementSnap = { entriesLen: number; occupied: Map<string, SolverSlot[]> };

function snapshotPlacement(
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
): PlacementSnap {
  const occCopy = new Map<string, SolverSlot[]>();
  for (const [k, v] of occupied) occCopy.set(k, [...v]);
  return { entriesLen: entries.length, occupied: occCopy };
}

function restorePlacement(
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  snap: PlacementSnap,
): void {
  entries.splice(snap.entriesLen);
  occupied.clear();
  for (const [k, v] of snap.occupied) occupied.set(k, v);
}

/** Desen sırası önemli değil; tüm blok permütasyonlarını dener, en çok yerleşeni seçer. */
export function placeByDayDistributionBestPermutation(
  a: SolverAssignment,
  need: number,
  pattern: number[],
  uid: string | null,
  workDays: number[],
  ctx: SolverContext,
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  placeOne: PlaceOneFn,
  canPlace: CanPlaceFn,
  totalWeeklyHours?: number,
): number {
  const total = totalWeeklyHours ?? need;
  if (!isValidDayDistribution(pattern, total)) return 0;

  const perms = distinctPatternPermutations(pattern);
  const start = snapshotPlacement(entries, occupied);
  let bestPlaced = 0;
  let bestState: PlacementSnap | null = null;

  for (const perm of perms) {
    restorePlacement(entries, occupied, start);
    const placed = placeByDayDistribution(
      a,
      need,
      perm,
      uid,
      workDays,
      ctx,
      entries,
      occupied,
      placeOne,
      canPlace,
      total,
    );
    if (placed > bestPlaced) {
      bestPlaced = placed;
      bestState = snapshotPlacement(entries, occupied);
      if (placed >= need) break;
    }
  }

  if (bestState) restorePlacement(entries, occupied, bestState);
  else restorePlacement(entries, occupied, start);
  return bestPlaced;
}

/** Kalan blokları (ardışık) yerleştir — tek tek saat dağıtımını önler. */
export function placeRemainingPatternChunks(
  a: SolverAssignment,
  need: number,
  pattern: number[],
  uid: string | null,
  workDays: number[],
  ctx: SolverContext,
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  placeOne: PlaceOneFn,
  canPlace: CanPlaceFn,
  totalWeeklyHours?: number,
): number {
  const remaining = remainingPatternChunks(a.id, entries, pattern);
  if (!remaining.length || need <= 0) return 0;
  return placeByDayDistributionBestPermutation(
    a,
    need,
    remaining,
    uid,
    workDays,
    ctx,
    entries,
    occupied,
    placeOne,
    canPlace,
    totalWeeklyHours,
  );
}

/** Skor / zorunlu yerleştirme deseni (enforce veya açık atama deseni). */
export function effectivePatternForAssignment(
  a: SolverAssignment,
  need: number,
  ctx?: SolverContext,
): number[] | null {
  if (ctx?.relax_constraints) return null;
  const raw = assignmentDayDistribution(a.options);
  if (raw && isValidDayDistribution(raw, need)) return raw;
  if (!shouldEnforceDistributionPattern(ctx?.distribution_policy)) return null;
  const block = assignmentBlockLessons(a.options);
  if (block >= 2 && need === block * 2) return [block, block];
  const mode = ctx?.distribution_policy?.mode ?? 'blocks';
  return inferDayDistribution(a.weekly_hours, a.options, a.biweekly, mode);
}

/** Üretimde denenecek desen (blok modunda yumuşak ipucu dahil). */
export function placementPatternForAssignment(
  a: SolverAssignment,
  need: number,
  ctx: SolverContext,
): number[] | null {
  if (ctx.relax_constraints) return null;
  const enforced = effectivePatternForAssignment(a, need, ctx);
  if (enforced) return enforced;
  const mode = ctx.distribution_policy?.mode ?? 'blocks';
  if (mode === 'compact') return null;
  const inferred = inferDayDistribution(a.weekly_hours, a.options, a.biweekly, mode);
  return isValidDayDistribution(inferred, need) ? inferred : null;
}
