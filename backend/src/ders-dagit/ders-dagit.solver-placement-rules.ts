import { planningPlacementBlocked } from './ders-dagit.planning-placement';
import { ruleOn, ruleOnForAssignment } from './ders-dagit.solver-rule-scope';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';
import { rulesForSection } from './ders-dagit.solver';

function maxPerDayFromRules(ctx: SolverContext, section: string): number | null {
  const rules = rulesForSection(ctx, section);
  if (rules.max_one_per_day?.active) return 1;
  if (rules.max_two_per_day?.active) {
    const m = Number(rules.max_two_per_day.params?.max);
    if (m >= 1 && m <= 8) return Math.floor(m);
    return 2;
  }
  return null;
}

function maxConsecutiveRun(ctx: SolverContext, section: string): number {
  const p = rulesForSection(ctx, section).four_plus_consecutive?.params as { max_run?: number } | undefined;
  const n = Number(p?.max_run ?? 4);
  return n >= 2 && n <= 8 ? Math.floor(n) : 4;
}

function minGapDays(ctx: SolverContext, section: string): number {
  const p = rulesForSection(ctx, section).two_two_day_gap?.params as { min_gap?: number } | undefined;
  const n = Number(p?.min_gap ?? 2);
  return n >= 2 && n <= 6 ? Math.floor(n) : 2;
}

function maxSamePeriodDays(ctx: SolverContext, section: string): number {
  const p = rulesForSection(ctx, section).max_same_period_week?.params as { max?: number } | undefined;
  const n = Number(p?.max ?? 2);
  return n >= 1 && n <= 7 ? Math.floor(n) : 2;
}

function effectiveMaxDaysPerWeek(ctx: SolverContext, section: string, a: SolverAssignment): number | null {
  if (a.max_days_per_week != null) return a.max_days_per_week;
  if (!ruleOnForAssignment(ctx, 'max_days_per_week_planning', section, a)) return null;
  const n = Number(rulesForSection(ctx, section).max_days_per_week_planning?.params?.max);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
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

function peMusicAllowedDays(ctx: SolverContext, section: string): number[] {
  const p = rulesForSection(ctx, section).meb_pe_music_days?.params as { days?: number[] } | undefined;
  return Array.isArray(p?.days) && p.days.length ? p.days : [2, 4];
}

/** Aktif kurallara göre yerleştirmeyi reddet (Faz 14–17). */
export function placementBlocked(
  entries: SolverSlot[],
  ctx: SolverContext,
  a: SolverAssignment,
  day: number,
  lesson: number,
  userId?: string | null,
): boolean {
  const onDay = assignmentOnDay(entries, a.id, day);
  const onDayCount = onDay.length;
  const eff = effHours(a);
  const days = assignmentDays(entries, a.id);
  const section = a.class_sections?.[0] ?? '';

  for (const block of a.unavailable_periods ?? []) {
    if (block.day_of_week === day) {
      if (block.lesson_num == null || block.lesson_num === lesson) return true;
    }
  }
  const maxDaysWeek = effectiveMaxDaysPerWeek(ctx, section, a);
  if (maxDaysWeek != null && !days.includes(day) && days.length >= maxDaysWeek) return true;

  const maxPerDayRule = ruleOnForAssignment(ctx, 'max_one_per_day', section, a)
    ? 1
    : ruleOnForAssignment(ctx, 'max_two_per_day', section, a)
      ? 2
      : null;
  const cap =
    maxPerDayRule != null
      ? Math.min(a.max_per_day ?? maxPerDayRule, maxPerDayRule)
      : a.max_per_day;
  if (cap != null && onDayCount >= cap) return true;

  if (ruleOnForAssignment(ctx, 'distribute_week', section, a) && eff >= 3 && onDayCount >= 2) return true;

  if (eff === 2) {
    if (ruleOnForAssignment(ctx, 'two_same_day', section, a) && days.length && !days.includes(day)) return true;
    if (ruleOnForAssignment(ctx, 'two_not_same_day', section, a) && onDayCount >= 1) return true;
    if (ruleOnForAssignment(ctx, 'two_not_consecutive_days', section, a)) {
      for (const d of days) {
        if (Math.abs(d - day) === 1) return true;
      }
    }
    if (ruleOnForAssignment(ctx, 'two_two_day_gap', section, a)) {
      const gap = minGapDays(ctx, section);
      for (const d of days) {
        if (d !== day && Math.abs(d - day) < gap) return true;
      }
    }
  }

  if (ruleOnForAssignment(ctx, 'same_day_consecutive', section, a) && onDayCount > 0) {
    const lessons = onDay.map((e) => e.lesson_num);
    const ok = lessons.some((l) => lesson === l + 1 || lesson === l - 1);
    if (!ok) return true;
  }

  if (ruleOnForAssignment(ctx, 'not_consecutive_same_hour', section, a) && onDayCount > 0) {
    const lessons = onDay.map((e) => e.lesson_num);
    if (lessons.some((l) => Math.abs(l - lesson) === 1)) return true;
  }

  if (ruleOnForAssignment(ctx, 'max_same_period_week', section, a)) {
    const samePeriodDays = new Set(
      entries
        .filter((e) => e.assignment_id === a.id && e.lesson_num === lesson)
        .map((e) => e.day_of_week),
    );
    if (!samePeriodDays.has(day) && samePeriodDays.size >= maxSamePeriodDays(ctx, section)) return true;
  }

  if (ruleOnForAssignment(ctx, 'no_compact_week', section, a) && eff >= 2) {
    const minDays = Math.min(ctx.work_days.length, Math.max(2, Math.ceil(eff / 2)));
    const placed = entries.filter((e) => e.assignment_id === a.id).length;
    const remaining = eff - placed - 1;
    const daysAfter = days.includes(day) ? days.length : days.length + 1;
    if (!days.includes(day) && daysAfter + remaining < minDays) return true;
  }

  if (ruleOnForAssignment(ctx, 'four_plus_consecutive', section, a)) {
    const lessons = onDay.map((e) => e.lesson_num);
    if (maxRunIfAdd(lessons, lesson) >= maxConsecutiveRun(ctx, section)) return true;
  }

  if (ruleOnForAssignment(ctx, 'min_two_per_day', section, a) && eff >= 2 && onDayCount === 1) {
    const only = onDay[0]!.lesson_num;
    if (lesson !== only + 1 && lesson !== only - 1) return true;
  }

  if (ruleOn(ctx, 'meb_pe_music_days', section) && isPeMusic(a.subject_name) && !peMusicAllowedDays(ctx, section).includes(day)) {
    return true;
  }

  if (ruleOn(ctx, 'meb_theory_am_practical_pm', section) && isPractical(a.subject_name) && lesson <= ctx.lunch_after_lesson) {
    return true;
  }

  if (ruleOnForAssignment(ctx, 'important_early', section, a) && lesson > 5) return true;

  if (ruleOnForAssignment(ctx, 'two_not_consecutive_days', section, a) && eff === 2) {
    for (const d of days) {
      if (Math.abs(d - day) === 1) return true;
    }
  }

  if (userId && ruleOn(ctx, 'minimize_teacher_gaps', '')) {
    const daySlots = entries
      .filter((e) => e.user_id === userId && e.day_of_week === day)
      .map((e) => e.lesson_num);
    if (daySlots.length > 0) {
      const all = [...daySlots, lesson].sort((x, y) => x - y);
      const span = all[all.length - 1]! - all[0]! + 1;
      if (span - all.length > 0) return true;
    }
  }

  if (planningPlacementBlocked(entries, ctx, a, day, lesson)) return true;

  return false;
}
