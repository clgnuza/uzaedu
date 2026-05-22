import { placementBlocked } from './ders-dagit.solver-placement-rules';
import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import {
  canPlace,
  runConstraintSolver,
  type SolverAssignment,
  type SolverContext,
  type SolverResult,
  type SolverSlot,
} from './ders-dagit.solver';
import { daysForAssignment } from './ders-dagit.solver-blocks';

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

function slotKey(day: number, lesson: number): string {
  return `${day}:${lesson}`;
}

function countAssignmentOnDay(entries: SolverSlot[], assignmentId: string, day: number): number {
  return entries.filter((e) => e.assignment_id === assignmentId && e.day_of_week === day).length;
}

function countTeacherOnDay(entries: SolverSlot[], userId: string, day: number): number {
  return entries.filter((e) => e.user_id === userId && e.day_of_week === day).length;
}

function countTeacherWeek(entries: SolverSlot[], userId: string): number {
  return entries.filter((e) => e.user_id === userId).length;
}

function teacherLimit(ctx: SolverContext, userId: string | null) {
  if (!userId) return null;
  return ctx.teacher_limits.find((t) => t.user_id === userId) ?? null;
}

function teacherWorkDays(entries: SolverSlot[], userId: string): Set<number> {
  const s = new Set<number>();
  for (const e of entries) {
    if (e.user_id === userId) s.add(e.day_of_week);
  }
  return s;
}

function isPmLesson(ctx: SolverContext, lesson: number): boolean {
  return lesson > ctx.lunch_after_lesson;
}

function violatesAmPmGap(
  entries: SolverSlot[],
  ctx: SolverContext,
  userId: string,
  day: number,
  lesson: number,
): boolean {
  const lim = teacherLimit(ctx, userId);
  if (!lim || lim.allow_am_pm_gap) return false;
  const sameDay = entries.filter((e) => e.user_id === userId && e.day_of_week === day);
  if (!sameDay.length) return false;
  const addingPm = isPmLesson(ctx, lesson);
  for (const e of sameDay) {
    if (addingPm !== isPmLesson(ctx, e.lesson_num)) return true;
  }
  return false;
}

function buildingOf(ctx: SolverContext, roomId: string | null): string | null {
  if (!roomId) return null;
  return ctx.room_building.get(roomId) ?? null;
}

function violatesBuildingRules(
  entries: SolverSlot[],
  ctx: SolverContext,
  userId: string | null,
  day: number,
  lesson: number,
  roomId: string | null,
): boolean {
  if (!userId) return false;
  const newB = buildingOf(ctx, roomId);
  const sameDay = entries.filter((e) => e.user_id === userId && e.day_of_week === day);
  if (ctx.no_building_same_day && newB) {
    for (const e of sameDay) {
      const b = buildingOf(ctx, e.room_id);
      if (b && b !== newB) return true;
    }
  }
  if (newB) {
    for (const e of sameDay) {
      const b = buildingOf(ctx, e.room_id);
      if (!b || b === newB) continue;
      const gap =
        ctx.building_travel_matrix.get(`${b}:${newB}`) ??
        ctx.building_travel_matrix.get(`${newB}:${b}`) ??
        ctx.building_travel_gap;
      if (gap > 0 && Math.abs(e.lesson_num - lesson) < gap) return true;
    }
  }
  return false;
}

function roomAllows(
  ctx: SolverContext,
  roomId: string | null,
  a: SolverAssignment,
  userId: string | null,
  classSection: string,
): boolean {
  if (!roomId) return true;
  const c = ctx.room_constraints.get(roomId);
  if (!c) return true;
  if (c.subjects?.length && !c.subjects.includes(a.subject_name)) return false;
  if (c.sections?.length && !c.sections.includes(classSection)) return false;
  if (c.teachers?.length && userId && !c.teachers.includes(userId)) return false;
  return true;
}

export function placementAllowed(
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  a: SolverAssignment,
  classSection: string,
  day: number,
  lesson: number,
  userId: string | null,
  ctx: SolverContext,
): boolean {
  if (!canPlace(occupied, day, lesson, classSection, userId, ctx, a)) return false;
  if (a.max_per_day != null && countAssignmentOnDay(entries, a.id, day) >= a.max_per_day) return false;
  if (ctx.room_required && !a.room_ids.length) return false;
  const lim = teacherLimit(ctx, userId);
  if (lim?.max_per_day != null && userId && countTeacherOnDay(entries, userId, day) >= lim.max_per_day) return false;
  if (lim?.max_weekly != null && userId && countTeacherWeek(entries, userId) >= lim.max_weekly) return false;
  if (userId && lim?.max_work_days != null) {
    const days = teacherWorkDays(entries, userId);
    if (!days.has(day) && days.size >= lim.max_work_days) return false;
  }
  if (userId && violatesAmPmGap(entries, ctx, userId, day, lesson)) return false;
  const room_id = a.room_ids[0] ?? null;
  if (!roomAllows(ctx, room_id, a, userId, classSection)) return false;
  if (placementBlocked(entries, ctx, a, day, lesson)) return false;
  if (violatesBuildingRules(entries, ctx, userId, day, lesson, room_id)) return false;
  return true;
}

function commitSlot(occupied: Map<string, SolverSlot[]>, slot: SolverSlot): void {
  const key = slotKey(slot.day_of_week, slot.lesson_num);
  const arr = occupied.get(key) ?? [];
  arr.push(slot);
  occupied.set(key, arr);
}

function uncommitSlot(occupied: Map<string, SolverSlot[]>, slot: SolverSlot): void {
  const key = slotKey(slot.day_of_week, slot.lesson_num);
  const arr = (occupied.get(key) ?? []).filter(
    (e) =>
      !(
        e.assignment_id === slot.assignment_id &&
        e.class_section === slot.class_section &&
        e.day_of_week === slot.day_of_week &&
        e.lesson_num === slot.lesson_num
      ),
  );
  if (arr.length) occupied.set(key, arr);
  else occupied.delete(key);
}

type PlaceTask = { a: SolverAssignment; classSection: string; userId: string | null };

function buildRemainingTasks(assignments: SolverAssignment[], entries: SolverSlot[]): PlaceTask[] {
  const tasks: PlaceTask[] = [];
  const sorted = [...assignments].sort((x, y) => (y.place_first ? 1 : 0) - (x.place_first ? 1 : 0));
  for (const a of sorted) {
    const placed = entries.filter((e) => e.assignment_id === a.id).length;
    let need = Math.max(0, effHours(a) - placed);
    const uid = a.teacher_ids[0] ?? null;
    let si = 0;
    while (need > 0 && a.class_sections.length) {
      tasks.push({ a, classSection: a.class_sections[si % a.class_sections.length]!, userId: uid });
      need--;
      si++;
    }
  }
  return tasks;
}

function lessonOrder(ctx: SolverContext, day: number): number[] {
  const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  const all = Array.from({ length: dayMax }, (_, i) => i + 1).filter((n) => !ctx.blocked_lesson_nums.has(n));
  return ctx.active_rules.important_early?.active ? all : [...all].reverse();
}

function finalizeResult(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
  occupied: Map<string, SolverSlot[]>,
): SolverResult {
  const violations: string[] = [];
  let clashCount = 0;
  for (const [, slots] of occupied) {
    const teachers = new Set(slots.map((s) => s.user_id).filter(Boolean));
    const classes = new Set(slots.map((s) => s.class_section));
    if (teachers.size < slots.filter((s) => s.user_id).length) clashCount++;
    if (classes.size < slots.length) clashCount++;
  }
  for (const a of assignments) {
    const used = new Set(entries.filter((e) => e.assignment_id === a.id).map((e) => e.day_of_week));
    if (a.min_days_per_week != null && used.size < a.min_days_per_week) {
      violations.push(`${a.subject_name}: min ${a.min_days_per_week} gün dağılımı sağlanamadı`);
    }
    const placed = entries.filter((e) => e.assignment_id === a.id).length;
    const need = effHours(a);
    if (placed < need) violations.push(`${a.subject_name}: ${need - placed} saat yerleşmedi`);
  }
  const soft = applySoftRulePenalties(entries, assignments, ctx);
  violations.push(...soft.violations);
  const target = assignments.reduce((s, a) => s + effHours(a), 0);
  const failed = Math.max(0, target - entries.length);
  const score = Math.round(
    Math.max(0, 100 - failed * 3 - violations.length * 2 - clashCount * 10 - soft.penalty),
  );
  return { entries, placed: entries.length, failed, violations, score };
}

function backtrack(
  taskIdx: number,
  tasks: PlaceTask[],
  entries: SolverSlot[],
  occupied: Map<string, SolverSlot[]>,
  ctx: SolverContext,
  nodes: { n: number },
  maxNodes: number,
): boolean {
  if (nodes.n > maxNodes) return false;
  if (taskIdx >= tasks.length) return true;
  const { a, classSection, userId } = tasks[taskIdx]!;
  const days = daysForAssignment(a, ctx.day_order?.length ? ctx.day_order : ctx.work_days);
  for (const day of days) {
    for (const lesson of lessonOrder(ctx, day)) {
      nodes.n++;
      if (!placementAllowed(entries, occupied, a, classSection, day, lesson, userId, ctx)) continue;
      const slot: SolverSlot = {
        day_of_week: day,
        lesson_num: lesson,
        class_section: classSection,
        subject: a.subject_name,
        user_id: userId,
        assignment_id: a.id,
        room_id: a.room_ids[0] ?? null,
        group_id: a.group_id,
      };
      entries.push(slot);
      commitSlot(occupied, slot);
      if (backtrack(taskIdx + 1, tasks, entries, occupied, ctx, nodes, maxNodes)) return true;
      entries.pop();
      uncommitSlot(occupied, slot);
    }
  }
  return false;
}

/** Kısıt geri izleme (Faz 20 tam CSP) — greedy taban + kalan slotlar için backtrack. */
export function runCspSolver(
  assignments: SolverAssignment[],
  ctx: SolverContext,
  maxNodes = 120_000,
): SolverResult {
  const base = runConstraintSolver(assignments, ctx);
  const tasks = buildRemainingTasks(assignments, base.entries);
  if (!tasks.length) return base;

  const entries = [...base.entries];
  const occupied = new Map<string, SolverSlot[]>();
  for (const e of entries) commitSlot(occupied, e);

  const ok = backtrack(0, tasks, entries, occupied, ctx, { n: 0 }, maxNodes);
  if (!ok) return base;
  const improved = finalizeResult(entries, assignments, ctx, occupied);
  return improved.score >= base.score || improved.failed < base.failed ? improved : base;
}
