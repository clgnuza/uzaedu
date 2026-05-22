import type { SolverSlot, SolverAssignment, SolverContext } from './ders-dagit.solver';

function ruleOn(ctx: SolverContext, key: string): boolean {
  return !!ctx.active_rules[key]?.active;
}

function ruleWeight(ctx: SolverContext, key: string, fallback = 5): number {
  const r = ctx.active_rules[key];
  if (!r?.active) return 0;
  return r.weight ?? fallback;
}

export function applySoftRulePenalties(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
): { penalty: number; violations: string[] } {
  const violations: string[] = [];
  let penalty = 0;

  for (const a of assignments) {
    const mine = entries.filter((e) => e.assignment_id === a.id);
    const byDay = new Map<number, SolverSlot[]>();
    for (const e of mine) {
      const arr = byDay.get(e.day_of_week) ?? [];
      arr.push(e);
      byDay.set(e.day_of_week, arr);
    }
    if (ruleOn(ctx, 'distribute_week') && a.weekly_hours >= 3 && byDay.size < Math.min(a.min_days_per_week ?? 2, 3)) {
      penalty += ruleWeight(ctx, 'distribute_week', 10);
      violations.push(`${a.subject_name}: haftaya yayılmamış`);
    }
    for (const [, slots] of byDay) {
      if (ruleOn(ctx, 'max_two_per_day') && slots.length > 2) {
        penalty += ruleWeight(ctx, 'max_two_per_day', 10);
        violations.push(`${a.subject_name}: günde 2+ aynı ders`);
      }
      if (ruleOn(ctx, 'max_one_per_day') && slots.length > 1) {
        penalty += ruleWeight(ctx, 'max_one_per_day', 8);
      }
      const lessons = slots.map((s) => s.lesson_num).sort((x, y) => x - y);
      if (ruleOn(ctx, 'same_day_consecutive') && lessons.length >= 2) {
        let ok = false;
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i] === lessons[i - 1] + 1) {
            ok = true;
            break;
          }
        }
        if (!ok) penalty += ruleWeight(ctx, 'same_day_consecutive', 8);
      }
      if (ruleOn(ctx, 'two_same_day') && a.weekly_hours === 2 && byDay.size > 1) {
        penalty += ruleWeight(ctx, 'two_same_day', 8);
      }
      if (ruleOn(ctx, 'two_not_same_day') && a.weekly_hours === 2 && [...byDay.values()].some((s) => s.length > 1)) {
        penalty += ruleWeight(ctx, 'two_not_same_day', 7);
      }
      if (ruleOn(ctx, 'two_not_consecutive_days') && a.weekly_hours === 2) {
        const dows = [...byDay.keys()].sort((x, y) => x - y);
        for (let i = 1; i < dows.length; i++) {
          if (dows[i]! - dows[i - 1]! === 1) penalty += ruleWeight(ctx, 'two_not_consecutive_days', 7);
        }
      }
      if (ruleOn(ctx, 'minimize_work_days') && a.teacher_ids[0]) {
        const tDays = new Set(mine.map((e) => e.day_of_week));
        penalty += tDays.size * ruleWeight(ctx, 'minimize_work_days', 8) * 0.2;
      }
      if (ruleOn(ctx, 'four_plus_consecutive') && lessons.length >= 4) {
        let run = 1;
        let maxRun = 1;
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i] === lessons[i - 1] + 1) run++;
          else run = 1;
          maxRun = Math.max(maxRun, run);
        }
        if (maxRun >= 4) {
          penalty += ruleWeight(ctx, 'four_plus_consecutive', 5);
          violations.push(`${a.subject_name}: 4+ ardışık slot`);
        }
      }
    }
  }

  if (ruleOn(ctx, 'minimize_teacher_gaps')) {
    const byTeacher = new Map<string, SolverSlot[]>();
    for (const e of entries) {
      if (!e.user_id) continue;
      const arr = byTeacher.get(e.user_id) ?? [];
      arr.push(e);
      byTeacher.set(e.user_id, arr);
    }
    for (const [, slots] of byTeacher) {
      for (let d = 1; d <= 7; d++) {
        const daySlots = slots.filter((s) => s.day_of_week === d).map((s) => s.lesson_num).sort((a, b) => a - b);
        if (daySlots.length < 2) continue;
        const span = daySlots[daySlots.length - 1]! - daySlots[0]! + 1;
        const gaps = span - daySlots.length;
        if (gaps > 0) penalty += gaps * ruleWeight(ctx, 'minimize_teacher_gaps', 12) * 0.5;
      }
    }
  }

  if (ruleOn(ctx, 'important_early')) {
    for (const e of entries) {
      if (e.lesson_num > 5) penalty += 0.5;
    }
  }

  if (ruleOn(ctx, 'minimize_building_moves') && ctx.room_building.size > 0) {
    const byTeacherDay = new Map<string, SolverSlot[]>();
    for (const e of entries) {
      if (!e.user_id) continue;
      const k = `${e.user_id}:${e.day_of_week}`;
      const arr = byTeacherDay.get(k) ?? [];
      arr.push(e);
      byTeacherDay.set(k, arr);
    }
    for (const slots of byTeacherDay.values()) {
      const buildings = slots
        .sort((a, b) => a.lesson_num - b.lesson_num)
        .map((s) => (s.room_id ? ctx.room_building.get(s.room_id) : null))
        .filter(Boolean);
      let moves = 0;
      for (let i = 1; i < buildings.length; i++) {
        if (buildings[i] !== buildings[i - 1]) moves++;
      }
      penalty += moves * ruleWeight(ctx, 'minimize_building_moves', 6) * 0.3;
    }
  }

  return { penalty, violations };
}
