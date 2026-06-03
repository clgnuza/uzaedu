import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { inferDayDistribution, isValidDayDistribution } from '@/lib/lesson-distribution';

export type AssignmentPlacementHint = {
  block_size: number;
  max_per_day: number;
  day_distribution?: number[] | null;
};

export function hintForAssignment(
  assignmentId: string | null | undefined,
  hints?: Record<string, AssignmentPlacementHint>,
): AssignmentPlacementHint | null {
  if (!assignmentId || !hints) return null;
  return hints[assignmentId] ?? null;
}

export function placementSpecFromHint(hint: AssignmentPlacementHint | null): AssignmentPlacementHint {
  return hint ?? { block_size: 0, max_per_day: 8, day_distribution: null };
}

/** API ipucu yoksa atamadaki mevcut yerleşimden blok boyutu çıkar. */
export function inferHintFromEntries(
  entries: EditorEntry[],
  assignmentId: string,
): AssignmentPlacementHint | null {
  const mine = entries.filter((e) => e.assignment_id === assignmentId);
  if (!mine.length) return null;
  const byDay = new Map<number, number[]>();
  for (const e of mine) {
    const arr = byDay.get(e.day_of_week) ?? [];
    arr.push(e.lesson_num);
    byDay.set(e.day_of_week, arr);
  }
  let maxOnDay = 0;
  let needsConsecutive = false;
  for (const lessons of byDay.values()) {
    maxOnDay = Math.max(maxOnDay, lessons.length);
    if (lessons.length >= 2) {
      const s = [...lessons].sort((a, b) => a - b);
      let ok = true;
      for (let i = 1; i < s.length; i++) {
        if (s[i]! !== s[i - 1]! + 1) ok = false;
      }
      if (!ok) needsConsecutive = true;
      if (lessons.length >= 2) return { block_size: Math.max(2, lessons.length), max_per_day: lessons.length, day_distribution: null };
    }
  }
  if (needsConsecutive) return { block_size: 2, max_per_day: maxOnDay || 2, day_distribution: null };
  return null;
}

export function resolvePlacementHint(
  entry: EditorEntry,
  hints?: Record<string, AssignmentPlacementHint>,
  allEntries?: EditorEntry[],
): AssignmentPlacementHint | null {
  const fromApi = hintForAssignment(entry.assignment_id, hints);
  if (fromApi && fromApi.block_size >= 2) return fromApi;
  if (entry.assignment_id && allEntries) {
    const inferred = inferHintFromEntries(allEntries, entry.assignment_id);
    if (inferred) return inferred;
  }
  return fromApi;
}

export function lessonsOnDayConsecutive(lessonNums: number[]): boolean {
  if (lessonNums.length <= 1) return true;
  const s = [...lessonNums].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) {
    if (s[i]! !== s[i - 1]! + 1) return false;
  }
  return true;
}

function projectedDayLessons(
  entries: EditorEntry[],
  assignmentId: string,
  day: number,
  excludeEntryId: string,
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
  return lessons;
}

export function assignmentBlockPlacementOk(
  entry: EditorEntry,
  day: number,
  lesson: number,
  entries: EditorEntry[],
  hint: AssignmentPlacementHint | null,
): boolean {
  if (!entry.assignment_id) return true;
  const spec = placementSpecFromHint(hint);
  const lessons = projectedDayLessons(entries, entry.assignment_id, day, entry.id, lesson);
  if (lessons.length > spec.max_per_day) return false;
  if (spec.block_size >= 2 || lessons.length >= 2) {
    return lessonsOnDayConsecutive(lessons);
  }
  return true;
}

export function allEntriesRespectAssignmentBlocks(
  entries: EditorEntry[],
  hints?: Record<string, AssignmentPlacementHint>,
): boolean {
  const ids = new Set(entries.map((e) => e.assignment_id).filter(Boolean) as string[]);
  for (const aid of ids) {
    const hint = hintForAssignment(aid, hints) ?? inferHintFromEntries(entries, aid);
    if (!hint || hint.block_size < 2) continue;
    const mine = entries.filter((e) => e.assignment_id === aid);
    const byDay = new Map<number, number[]>();
    for (const e of mine) {
      const arr = byDay.get(e.day_of_week) ?? [];
      arr.push(e.lesson_num);
      byDay.set(e.day_of_week, arr);
    }
    for (const lessons of byDay.values()) {
      if (lessons.length > hint.max_per_day) return false;
      if (hint.block_size >= 2 || lessons.length >= 2) {
        if (!lessonsOnDayConsecutive(lessons)) return false;
      }
    }
  }
  return true;
}

export function blockPlacementErrorMessage(hint: AssignmentPlacementHint | null): string {
  const n = hint?.block_size ?? 2;
  return `Blok ders (${n}+${n} vb.): aynı günde ardışık saatlere yerleştirin.`;
}

/** Havuz yerleştirme: atama satırından desen. */
export function hintFromUnplaced(
  assignmentId: string,
  weeklyHours: number,
  biweekly: boolean,
  hints?: Record<string, AssignmentPlacementHint>,
): AssignmentPlacementHint {
  const fromApi = hints?.[assignmentId];
  if (fromApi) return fromApi;
  const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const dist = inferDayDistribution(weeklyHours, {}, biweekly);
  const block = Math.max(...dist) >= 2 ? Math.max(...dist) : 0;
  return {
    block_size: block,
    max_per_day: dist.length ? Math.max(...dist) : block || 8,
    day_distribution: isValidDayDistribution(dist, eff) ? dist : null,
  };
}
