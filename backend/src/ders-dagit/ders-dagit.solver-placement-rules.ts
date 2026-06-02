import { planningPlacementBlocked } from './ders-dagit.planning-placement';
import { ruleOn } from './ders-dagit.solver-rule-scope';
import type { SolverAssignment, SolverContext, SolverSlot } from './ders-dagit.solver';
import { rulesForSection } from './ders-dagit.solver';

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
  const days = assignmentDays(entries, a.id);
  const section = a.class_sections?.[0] ?? '';

  for (const block of a.unavailable_periods ?? []) {
    if (block.day_of_week === day) {
      if (block.lesson_num == null || block.lesson_num === lesson) return true;
    }
  }
  // Yalnızca atama üzerinde açıkça tanımlı sert limit.
  if (a.max_days_per_week != null && !days.includes(day) && days.length >= a.max_days_per_week) return true;

  // Pedagoji kuralları (ASC'de de çoğu okulda "hard" gibi davranır).
  if (ruleOn(ctx, 'meb_pe_music_days', section) && isPeMusic(a.subject_name) && !peMusicAllowedDays(ctx, section).includes(day)) {
    return true;
  }

  if (ruleOn(ctx, 'meb_theory_am_practical_pm', section) && isPractical(a.subject_name) && lesson <= ctx.lunch_after_lesson) {
    return true;
  }

  if (planningPlacementBlocked(entries, ctx, a, day, lesson)) return true;

  return false;
}
