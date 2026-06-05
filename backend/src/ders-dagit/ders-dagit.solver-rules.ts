import {
  assignmentBlockPlacementOkForAssignment,
  assignmentPlacementSpec,
  lessonsOnDayConsecutive,
} from './ders-dagit.assignment-blocks';
import {
  assignmentByDayLessons,
  distributionPatternForScoring,
  matchesDayDistributionPattern,
  observedDayDistributionChunks,
} from './ders-dagit.day-distribution';
import { shouldEnforceDistributionPattern } from './ders-dagit.distribution-policy';
import { isStrictRule } from './ders-dagit.rules-merge';
import { ruleOn, ruleOnForAssignment } from './ders-dagit.solver-rule-scope';
import type { SolverSlot, SolverAssignment, SolverContext } from './ders-dagit.solver';
import { rulesForSection } from './ders-dagit.solver';

function ruleWeight(ctx: SolverContext, key: string, section: string, fallback = 5): number {
  const r = rulesForSection(ctx, section)[key];
  if (!r?.active) return 0;
  const w = r.weight ?? fallback;
  return isStrictRule(ctx, key, section) ? Math.max(w, 14) * 100 : w;
}

export type RuleViolationDetail = {
  message: string;
  assignment_id: string;
  subject: string;
  class_section: string;
  rule_key: string;
};

function addViolation(
  ctx: SolverContext,
  violations: string[],
  strictHits: string[],
  details: RuleViolationDetail[],
  key: string,
  section: string,
  message: string,
  assignment: SolverAssignment,
) {
  violations.push(message);
  if (isStrictRule(ctx, key, section)) strictHits.push(message);
  details.push({
    message,
    assignment_id: assignment.id,
    subject: assignment.subject_name,
    class_section: section,
    rule_key: key,
  });
}

function pushAssignmentViolation(
  violations: string[],
  details: RuleViolationDetail[],
  assignment: SolverAssignment,
  section: string,
  rule_key: string,
  message: string,
) {
  violations.push(message);
  details.push({
    message,
    assignment_id: assignment.id,
    subject: assignment.subject_name,
    class_section: section,
    rule_key,
  });
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

function slotMarkedUnavailable(
  ctx: SolverContext,
  day: number,
  lesson: number,
  userId: string | null,
): boolean {
  for (const u of ctx.unavailable) {
    if (u.day_of_week !== day) continue;
    if (u.lesson_num != null && u.lesson_num !== lesson) continue;
    if (u.user_id && userId && u.user_id !== userId) continue;
    if (!u.user_id && userId) continue;
    return true;
  }
  return false;
}

function assignmentSlotBlocked(
  a: SolverAssignment,
  day: number,
  lesson: number,
): boolean {
  for (const block of a.unavailable_periods ?? []) {
    if (block.day_of_week === day) {
      if (block.lesson_num == null || block.lesson_num === lesson) return true;
    }
  }
  return false;
}

export function applySoftRulePenalties(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
): { penalty: number; violations: string[]; strict_violations: string[]; violation_details: RuleViolationDetail[] } {
  const violations: string[] = [];
  const strict_violations: string[] = [];
  const violation_details: RuleViolationDetail[] = [];
  let penalty = 0;

  for (const a of assignments) {
    const section = a.class_sections?.[0] ?? '';
    const mine = entries.filter((e) => e.assignment_id === a.id);
    const byDay = new Map<number, SolverSlot[]>();
    for (const e of mine) {
      const arr = byDay.get(e.day_of_week) ?? [];
      arr.push(e);
      byDay.set(e.day_of_week, arr);
    }
    const effH = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
    const scorePattern = ctx.relax_constraints
      ? null
      : distributionPatternForScoring(a.weekly_hours, a.options, a.biweekly, ctx.distribution_policy);
    if (scorePattern) {
      const byDayLessons = assignmentByDayLessons(entries, a.id);
      const placedHours = [...byDayLessons.values()].reduce((s, lessons) => s + lessons.length, 0);
      if (placedHours < effH) continue;
      if (!matchesDayDistributionPattern(byDayLessons, scorePattern)) {
        const actual = observedDayDistributionChunks(byDayLessons);
        penalty += shouldEnforceDistributionPattern(ctx.distribution_policy) ? 28 : 22;
        pushAssignmentViolation(
          violations,
          violation_details,
          a,
          section,
          'day_distribution',
          `${a.subject_name}: haftalık dağılım ${scorePattern.join('+')} ile uyuşmuyor (gerçek: ${actual.join('+')}; gün sırası serbest, bloklar ardışık olmalı)`,
        );
      }
    }
    const blockSpec = assignmentPlacementSpec(a.options, a.weekly_hours, a.biweekly);
    if (
      !ctx.relax_constraints &&
      blockSpec.block_size >= 2 &&
      mine.length &&
      !assignmentBlockPlacementOkForAssignment(mine, a.id, blockSpec)
    ) {
      penalty += 24;
      pushAssignmentViolation(
        violations,
        violation_details,
        a,
        section,
        'block_lessons',
        `${a.subject_name}: blok dersler aynı günde ardışık saatlerde olmalı`,
      );
    }
    if (ruleOnForAssignment(ctx, 'distribute_week', section, a) && a.weekly_hours >= 3 && byDay.size < Math.min(a.min_days_per_week ?? 2, 3)) {
      penalty += ruleWeight(ctx, 'distribute_week', section, 10);
      addViolation(ctx, violations, strict_violations, violation_details, 'distribute_week', section, `${a.subject_name}: haftaya yayılmamış`, a);
    }
    const byDayLessons = assignmentByDayLessons(entries, a.id);
    const daysUsed = byDayLessons.size;
    for (const [, lessons] of byDayLessons) {
      if (ruleOnForAssignment(ctx, 'max_two_per_day', section, a) && lessons.length > 2) {
        penalty += ruleWeight(ctx, 'max_two_per_day', section, 10);
        addViolation(ctx, violations, strict_violations, violation_details, 'max_two_per_day', section, `${a.subject_name}: günde 2+ aynı ders`, a);
      }
      if (ruleOnForAssignment(ctx, 'max_one_per_day', section, a) && lessons.length > 1) {
        penalty += ruleWeight(ctx, 'max_one_per_day', section, 8);
        addViolation(ctx, violations, strict_violations, violation_details, 'max_one_per_day', section, `${a.subject_name}: günde 1+ aynı ders`, a);
      }
      if (ruleOnForAssignment(ctx, 'same_day_consecutive', section, a) && lessons.length >= 2) {
        if (!lessonsOnDayConsecutive(lessons)) {
          penalty += ruleWeight(ctx, 'same_day_consecutive', section, 10);
          addViolation(ctx, violations, strict_violations, violation_details, 'same_day_consecutive', section, `${a.subject_name}: aynı gün ardışık değil`, a);
        }
      }
    }
    for (const e of mine) {
      if (e.user_id && slotMarkedUnavailable(ctx, e.day_of_week, e.lesson_num, e.user_id)) {
        penalty += 16;
        pushAssignmentViolation(
          violations,
          violation_details,
          a,
          section,
          'teacher_unavailable',
          `${a.subject_name}: öğretmen müsait değil (${e.day_of_week}. gün ${e.lesson_num}. saat)`,
        );
        break;
      }
      if (assignmentSlotBlocked(a, e.day_of_week, e.lesson_num)) {
        penalty += 14;
        pushAssignmentViolation(
          violations,
          violation_details,
          a,
          section,
          'assignment_unavailable',
          `${a.subject_name}: atama yasak slot (${e.day_of_week}. gün ${e.lesson_num}. saat)`,
        );
        break;
      }
    }
    if (ruleOnForAssignment(ctx, 'two_same_day', section, a) && effH === 2 && daysUsed > 1) {
      penalty += ruleWeight(ctx, 'two_same_day', section, 8);
      addViolation(ctx, violations, strict_violations, violation_details, 'two_same_day', section, `${a.subject_name}: 2 saat aynı günde olmalı`, a);
    }
    if (
      ruleOnForAssignment(ctx, 'two_not_same_day', section, a) &&
      effH === 2 &&
      [...byDayLessons.values()].some((lessons) => lessons.length > 1)
    ) {
      penalty += ruleWeight(ctx, 'two_not_same_day', section, 7);
      addViolation(ctx, violations, strict_violations, violation_details, 'two_not_same_day', section, `${a.subject_name}: 2 saat farklı günlerde olmalı`, a);
    }
    if (ruleOnForAssignment(ctx, 'two_not_consecutive_days', section, a) && effH === 2) {
      const dows = [...byDayLessons.keys()].sort((x, y) => x - y);
      for (let i = 1; i < dows.length; i++) {
        if (dows[i]! - dows[i - 1]! === 1) {
          penalty += ruleWeight(ctx, 'two_not_consecutive_days', section, 7);
          addViolation(
            ctx,
            violations,
            strict_violations,
            violation_details,
            'two_not_consecutive_days',
            section,
            `${a.subject_name}: ardışık günlerde olmamalı`,
            a,
          );
          break;
        }
      }
    }
    if (ruleOnForAssignment(ctx, 'two_two_day_gap', section, a) && effH === 2) {
      const dows = [...byDayLessons.keys()].sort((x, y) => x - y);
      const gap = (() => {
        const p = rulesForSection(ctx, section).two_two_day_gap?.params as { min_gap?: number } | undefined;
        const n = Number(p?.min_gap ?? 2);
        return n >= 2 && n <= 6 ? Math.floor(n) : 2;
      })();
      for (let i = 1; i < dows.length; i++) {
        if (dows[i]! - dows[i - 1]! < gap) {
          penalty += ruleWeight(ctx, 'two_two_day_gap', section, 7);
          addViolation(
            ctx,
            violations,
            strict_violations,
            violation_details,
            'two_two_day_gap',
            section,
            `${a.subject_name}: günler arası en az ${gap} gün boşluk`,
            a,
          );
          break;
        }
      }
    }
    const maxRunCap = (() => {
      const p = rulesForSection(ctx, section).four_plus_consecutive?.params as { max_run?: number } | undefined;
      const n = Number(p?.max_run ?? 4);
      return n >= 2 && n <= 8 ? Math.floor(n) : 4;
    })();
    for (const [, lessons] of byDayLessons) {
      if (ruleOnForAssignment(ctx, 'four_plus_consecutive', section, a) && lessons.length >= 2) {
        let run = 1;
        let maxRun = 1;
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i]! === lessons[i - 1]! + 1) run++;
          else run = 1;
          maxRun = Math.max(maxRun, run);
        }
        if (maxRun >= maxRunCap) {
          penalty += ruleWeight(ctx, 'four_plus_consecutive', section, 5);
          addViolation(ctx, violations, strict_violations, violation_details, 'four_plus_consecutive', section, `${a.subject_name}: 4+ ardışık slot`, a);
        }
      }
    }
    if (ruleOn(ctx, 'meb_pe_music_days', section) && isPeMusic(a.subject_name)) {
      const allowed = peMusicAllowedDays(ctx, section);
      for (const e of mine) {
        if (!allowed.includes(e.day_of_week)) {
          penalty += ruleWeight(ctx, 'meb_pe_music_days', section, 8);
          addViolation(
            ctx,
            violations,
            strict_violations,
            violation_details,
            'meb_pe_music_days',
            section,
            `${a.subject_name}: izin verilmeyen günde`,
            a,
          );
          break;
        }
      }
    }
    if (ruleOn(ctx, 'meb_theory_am_practical_pm', section) && isPractical(a.subject_name)) {
      for (const e of mine) {
        if (e.lesson_num <= ctx.lunch_after_lesson) {
          penalty += ruleWeight(ctx, 'meb_theory_am_practical_pm', section, 8);
          addViolation(
            ctx,
            violations,
            strict_violations,
            violation_details,
            'meb_theory_am_practical_pm',
            section,
            `${a.subject_name}: uygulamalı öğleden önce`,
            a,
          );
          break;
        }
      }
    }
    if (ruleOn(ctx, 'minimize_work_days', section) && a.teacher_ids[0]) {
      penalty += daysUsed * ruleWeight(ctx, 'minimize_work_days', section, 8) * 0.2;
    }
  }

  if (ruleOn(ctx, 'minimize_teacher_gaps', '')) {
    const byTeacher = new Map<string, SolverSlot[]>();
    for (const e of entries) {
      if (!e.user_id) continue;
      const arr = byTeacher.get(e.user_id) ?? [];
      arr.push(e);
      byTeacher.set(e.user_id, arr);
    }
    for (const [userId, slots] of byTeacher) {
      for (let d = 1; d <= 7; d++) {
        const daySlots = slots.filter((s) => s.day_of_week === d).map((s) => s.lesson_num).sort((a, b) => a - b);
        if (daySlots.length < 2) continue;
        const span = daySlots[daySlots.length - 1]! - daySlots[0]! + 1;
        const gaps = span - daySlots.length;
        if (gaps > 0) {
          penalty += gaps * ruleWeight(ctx, 'minimize_teacher_gaps', '', 12) * 0.5;
          violations.push(`Öğretmen ${userId.slice(0, 8)}: gün ${d} boşluk`);
        }
      }
    }
  }

  const assignById = new Map(assignments.map((a) => [a.id, a]));
  for (const e of entries) {
    const a = assignById.get(e.assignment_id);
    if (!a) continue;
    const sec = e.class_section;
    if (!ruleOnForAssignment(ctx, 'important_early', sec, a)) continue;
    if (e.lesson_num > 5) {
      penalty += ruleWeight(ctx, 'important_early', sec, 4);
      addViolation(
        ctx,
        violations,
        strict_violations,
        violation_details,
        'important_early',
        sec,
        `${e.subject}: geç saat (${e.lesson_num})`,
        a,
      );
    }
  }

  if (ruleOn(ctx, 'minimize_building_moves', '') && ctx.room_building.size > 0) {
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
      if (moves > 0) {
        penalty += moves * ruleWeight(ctx, 'minimize_building_moves', '', 6) * 0.3;
        violations.push(`Bina geçişi: ${moves} kez`);
      }
    }
  }

  return { penalty, violations, strict_violations, violation_details };
}
