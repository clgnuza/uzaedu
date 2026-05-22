import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';

function ruleOn(ctx: SolverContext, key: string): boolean {
  return !!ctx.active_rules[key]?.active;
}

function effHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
}

function assignmentOnDay(entries: SolverSlot[], assignmentId: string, day: number): SolverSlot[] {
  return entries.filter((e) => e.assignment_id === assignmentId && e.day_of_week === day);
}

function assignmentDays(entries: SolverSlot[], assignmentId: string): number[] {
  const s = new Set<number>();
  for (const e of entries) {
    if (e.assignment_id === assignmentId) s.add(e.day_of_week);
  }
  return [...s];
}

function maxRunIfAdd(lessons: number[], lesson: number): number {
  const all = [...lessons, lesson].sort((a, b) => a - b);
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < all.length; i++) {
    if (all[i] === all[i - 1]! + 1) run++;
    else run = 1;
    maxRun = Math.max(maxRun, run);
  }
  return maxRun;
}

function isPeMusic(name: string): boolean {
  return /beden|müzik|muzik|spor|fizik\s*etkin/i.test(name);
}

function isPractical(name: string): boolean {
  return /uygulama|atölye|laboratuvar|\blab\b|pratik/i.test(name);
}

function peMusicAllowedDays(ctx: SolverContext): number[] {
  const p = ctx.active_rules.meb_pe_music_days?.params as { days?: number[] } | undefined;
  return Array.isArray(p?.days) && p.days.length ? p.days : [2, 4];
}

/** Aktif kurallara göre yerleştirmeyi reddet (Faz 14–17). */
export function placementBlocked(
  entries: SolverSlot[],
  ctx: SolverContext,
  a: SolverAssignment,
  day: number,
  lesson: number,
): boolean {
  const onDay = assignmentOnDay(entries, a.id, day);
  const onDayCount = onDay.length;
  const eff = effHours(a);
  const days = assignmentDays(entries, a.id);

  for (const block of a.unavailable_periods ?? []) {
    if (block.day_of_week === day) {
      if (block.lesson_num == null || block.lesson_num === lesson) return true;
    }
  }
  if (a.max_days_per_week != null && !days.includes(day) && days.length >= a.max_days_per_week) return true;

  const maxPerDayRule = ruleOn(ctx, 'max_one_per_day') ? 1 : ruleOn(ctx, 'max_two_per_day') ? 2 : null;
  const cap =
    maxPerDayRule != null
      ? Math.min(a.max_per_day ?? maxPerDayRule, maxPerDayRule)
      : a.max_per_day;
  if (cap != null && onDayCount >= cap) return true;

  if (ruleOn(ctx, 'distribute_week') && eff >= 3 && onDayCount >= 2) return true;

  if (eff === 2) {
    if (ruleOn(ctx, 'two_same_day') && days.length && !days.includes(day)) return true;
    if (ruleOn(ctx, 'two_not_same_day') && onDayCount >= 1) return true;
    if (ruleOn(ctx, 'two_not_consecutive_days')) {
      for (const d of days) {
        if (Math.abs(d - day) === 1) return true;
      }
    }
    if (ruleOn(ctx, 'two_two_day_gap')) {
      for (const d of days) {
        if (d !== day && Math.abs(d - day) < 3) return true;
      }
    }
  }

  if (ruleOn(ctx, 'same_day_consecutive') && onDayCount > 0) {
    const lessons = onDay.map((e) => e.lesson_num);
    const ok = lessons.some((l) => lesson === l + 1 || lesson === l - 1);
    if (!ok) return true;
  }

  if (ruleOn(ctx, 'four_plus_consecutive')) {
    const lessons = onDay.map((e) => e.lesson_num);
    if (maxRunIfAdd(lessons, lesson) >= 4) return true;
  }

  if (ruleOn(ctx, 'min_two_per_day') && eff >= 2 && onDayCount === 1) {
    const only = onDay[0]!.lesson_num;
    if (lesson !== only + 1 && lesson !== only - 1) return true;
  }

  if (ruleOn(ctx, 'meb_pe_music_days') && isPeMusic(a.subject_name) && !peMusicAllowedDays(ctx).includes(day)) {
    return true;
  }

  if (ruleOn(ctx, 'meb_theory_am_practical_pm') && isPractical(a.subject_name) && lesson <= ctx.lunch_after_lesson) {
    return true;
  }

  return false;
}
