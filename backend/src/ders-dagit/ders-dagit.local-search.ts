import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import { placementBlocked } from './ders-dagit.solver-placement-rules';
import {
  canPlace,
  runConstraintSolver,
  type SolverAssignment,
  type SolverContext,
  type SolverResult,
  type SolverSlot,
} from './ders-dagit.solver';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

function better(a: SolverResult, b: SolverResult): boolean {
  if (a.failed !== b.failed) return a.failed < b.failed;
  if (a.score !== b.score) return a.score > b.score;
  return a.violations.length < b.violations.length;
}

function scoreEntries(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
): number {
  const soft = applySoftRulePenalties(entries, assignments, ctx);
  const target = assignments.reduce((s, a) => s + effHours(a), 0);
  const failed = Math.max(0, target - entries.length);
  const strictPenalty = soft.strict_violations.length * 50;
  return Math.round(Math.max(0, 100 - failed * 3 - soft.penalty - strictPenalty));
}

function isValidEntries(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
): boolean {
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const occupied = new Map<string, SolverSlot[]>();
  const built: SolverSlot[] = [];
  for (const e of entries) {
    if (!e?.assignment_id) return false;
    const a = byId.get(e.assignment_id);
    if (!a) return false;
    if (!canPlace(occupied, e.day_of_week, e.lesson_num, e.class_section, e.user_id, ctx, a)) {
      return false;
    }
    if (placementBlocked(built, ctx, a, e.day_of_week, e.lesson_num, e.user_id)) return false;
    built.push(e);
    const key = `${e.day_of_week}:${e.lesson_num}`;
    const arr = occupied.get(key) ?? [];
    arr.push(e);
    occupied.set(key, arr);
  }
  const soft = applySoftRulePenalties(entries, assignments, ctx);
  return soft.strict_violations.length === 0;
}

/** İki slot takası + tek slot taşıma (Faz 20). */
function repairWithMoves(
  base: SolverResult,
  assignments: SolverAssignment[],
  ctx: SolverContext,
  attempts: number,
): SolverResult {
  let entries = base.entries.filter(Boolean);
  if (!entries.length) return base;
  let score = scoreEntries(entries, assignments, ctx);
  const byId = new Map(assignments.map((a) => [a.id, a]));

  for (let n = 0; n < attempts; n++) {
    if (!entries.length) break;
    if (entries.length >= 2 && n % 3 !== 2) {
      const i = Math.floor(Math.random() * entries.length);
      let j = Math.floor(Math.random() * entries.length);
      if (i === j) continue;
      const ei = entries[i];
      const ej = entries[j];
      if (!ei || !ej) continue;
      const trial = entries.map((e, idx) => {
        if (idx === i) return { ...e, day_of_week: ej.day_of_week, lesson_num: ej.lesson_num };
        if (idx === j) return { ...e, day_of_week: ei.day_of_week, lesson_num: ei.lesson_num };
        return e;
      });
      if (isValidEntries(trial, assignments, ctx)) {
        const sc = scoreEntries(trial, assignments, ctx);
        if (sc > score) {
          entries = trial;
          score = sc;
        }
      }
      continue;
    }

    const i = Math.floor(Math.random() * entries.length);
    const e = entries[i];
    if (!e) continue;
    const a = byId.get(e.assignment_id);
    if (!a) continue;
    const rest = entries.filter((_, idx) => idx !== i);
    const occupied = new Map<string, SolverSlot[]>();
    for (const x of rest) {
      const key = `${x.day_of_week}:${x.lesson_num}`;
      const arr = occupied.get(key) ?? [];
      arr.push(x);
      occupied.set(key, arr);
    }
    const days = ctx.day_order?.length ? ctx.day_order : ctx.work_days;
    for (const day of shuffle(days)) {
      const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
      const lessons = shuffle(
        Array.from({ length: dayMax }, (_, k) => k + 1).filter((l) => !ctx.blocked_lesson_nums.has(l)),
      );
      for (const lesson of lessons) {
        if (!canPlace(occupied, day, lesson, e.class_section, e.user_id, ctx, a)) continue;
        if (placementBlocked(rest, ctx, a, day, lesson, e.user_id)) continue;
        const trial = [...rest, { ...e, day_of_week: day, lesson_num: lesson }];
        if (!isValidEntries(trial, assignments, ctx)) continue;
        const sc = scoreEntries(trial, assignments, ctx);
        if (sc > score) {
          entries = trial;
          score = sc;
          break;
        }
      }
    }
  }

  const target = assignments.reduce((s, a) => s + effHours(a), 0);
  return {
    ...base,
    entries,
    placed: entries.length,
    failed: Math.max(0, target - entries.length),
    score,
  };
}

/** Greedy + CSP taban + gün sırası + swap/taşıma (Faz 20). */
export function improveWithLocalSearch(
  assignments: SolverAssignment[],
  ctx: SolverContext,
  iterations = 24,
  seed?: SolverResult,
): SolverResult {
  let best = seed ?? runConstraintSolver(assignments, ctx);
  const baseDays = ctx.work_days.length ? ctx.work_days : [1, 2, 3, 4, 5];
  const repairPasses = Math.max(8, Math.floor(iterations / 2));
  for (let i = 0; i < iterations; i++) {
    const cand = runConstraintSolver(assignments, {
      ...ctx,
      day_order: i === 0 ? ctx.day_order : shuffle(baseDays),
    });
    const repaired = repairWithMoves(cand, assignments, ctx, repairPasses);
    if (better(repaired, best)) best = repaired;
    else if (better(cand, best)) best = cand;
  }
  return repairWithMoves(best, assignments, ctx, repairPasses);
}
