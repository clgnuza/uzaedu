import { assignmentDayDistribution, isValidDayDistribution } from './ders-dagit.day-distribution';
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

function addViolation(
  ctx: SolverContext,
  violations: string[],
  strictHits: string[],
  key: string,
  section: string,
  message: string,
) {
  violations.push(message);
  if (isStrictRule(ctx, key, section)) strictHits.push(message);
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

export function applySoftRulePenalties(
  entries: SolverSlot[],
  assignments: SolverAssignment[],
  ctx: SolverContext,
): { penalty: number; violations: string[]; strict_violations: string[] } {
  const violations: string[] = [];
  const strict_violations: string[] = [];
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
    const dist = assignmentDayDistribution(a.options);
    const effH = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
    if (dist && isValidDayDistribution(dist, effH)) {
      const counts = [...byDay.values()].map((s) => s.length).sort((x, y) => x - y);
      const expected = [...dist].sort((x, y) => x - y);
      const ok =
        counts.length === expected.length && counts.every((c, i) => c === expected[i]);
      if (!ok) {
        penalty += 12;
        violations.push(
          `${a.subject_name}: dağılım ${dist.join('+')} ile uyuşmuyor (gerçek: ${counts.join('+')})`,
        );
      }
    }
    if (ruleOnForAssignment(ctx, 'distribute_week', section, a) && a.weekly_hours >= 3 && byDay.size < Math.min(a.min_days_per_week ?? 2, 3)) {
      penalty += ruleWeight(ctx, 'distribute_week', section, 10);
      addViolation(ctx, violations, strict_violations, 'distribute_week', section, `${a.subject_name}: haftaya yayılmamış`);
    }
    for (const [, slots] of byDay) {
      if (ruleOnForAssignment(ctx, 'max_two_per_day', section, a) && slots.length > 2) {
        penalty += ruleWeight(ctx, 'max_two_per_day', section, 10);
        addViolation(ctx, violations, strict_violations, 'max_two_per_day', section, `${a.subject_name}: günde 2+ aynı ders`);
      }
      if (ruleOnForAssignment(ctx, 'max_one_per_day', section, a) && slots.length > 1) {
        penalty += ruleWeight(ctx, 'max_one_per_day', section, 8);
        addViolation(ctx, violations, strict_violations, 'max_one_per_day', section, `${a.subject_name}: günde 1+ aynı ders`);
      }
      const lessons = slots.map((s) => s.lesson_num).sort((x, y) => x - y);
      if (ruleOnForAssignment(ctx, 'same_day_consecutive', section, a) && lessons.length >= 2) {
        let ok = false;
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i] === lessons[i - 1] + 1) {
            ok = true;
            break;
          }
        }
        if (!ok) {
          penalty += ruleWeight(ctx, 'same_day_consecutive', section, 8);
          addViolation(ctx, violations, strict_violations, 'same_day_consecutive', section, `${a.subject_name}: aynı gün ardışık değil`);
        }
      }
      if (ruleOnForAssignment(ctx, 'two_same_day', section, a) && a.weekly_hours === 2 && byDay.size > 1) {
        penalty += ruleWeight(ctx, 'two_same_day', section, 8);
        addViolation(ctx, violations, strict_violations, 'two_same_day', section, `${a.subject_name}: 2 saat aynı günde olmalı`);
      }
      if (ruleOnForAssignment(ctx, 'two_not_same_day', section, a) && a.weekly_hours === 2 && [...byDay.values()].some((s) => s.length > 1)) {
        penalty += ruleWeight(ctx, 'two_not_same_day', section, 7);
        addViolation(ctx, violations, strict_violations, 'two_not_same_day', section, `${a.subject_name}: 2 saat farklı günlerde olmalı`);
      }
      if (ruleOnForAssignment(ctx, 'two_not_consecutive_days', section, a) && a.weekly_hours === 2) {
        const dows = [...byDay.keys()].sort((x, y) => x - y);
        for (let i = 1; i < dows.length; i++) {
          if (dows[i]! - dows[i - 1]! === 1) {
            penalty += ruleWeight(ctx, 'two_not_consecutive_days', section, 7);
            addViolation(
              ctx,
              violations,
              strict_violations,
              'two_not_consecutive_days',
              section,
              `${a.subject_name}: ardışık günlerde olmamalı`,
            );
          }
        }
      }
      if (ruleOnForAssignment(ctx, 'two_two_day_gap', section, a) && a.weekly_hours === 2) {
        const dows = [...byDay.keys()].sort((x, y) => x - y);
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
              'two_two_day_gap',
              section,
              `${a.subject_name}: günler arası en az ${gap} gün boşluk`,
            );
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
              'meb_pe_music_days',
              section,
              `${a.subject_name}: izin verilmeyen günde`,
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
              'meb_theory_am_practical_pm',
              section,
              `${a.subject_name}: uygulamalı öğleden önce`,
            );
            break;
          }
        }
      }
      if (ruleOn(ctx, 'minimize_work_days', section) && a.teacher_ids[0]) {
        const tDays = new Set(mine.map((e) => e.day_of_week));
        penalty += tDays.size * ruleWeight(ctx, 'minimize_work_days', section, 8) * 0.2;
      }
      const maxRunCap = (() => {
        const p = rulesForSection(ctx, section).four_plus_consecutive?.params as { max_run?: number } | undefined;
        const n = Number(p?.max_run ?? 4);
        return n >= 2 && n <= 8 ? Math.floor(n) : 4;
      })();
      if (ruleOnForAssignment(ctx, 'four_plus_consecutive', section, a) && lessons.length >= maxRunCap) {
        let run = 1;
        let maxRun = 1;
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i] === lessons[i - 1] + 1) run++;
          else run = 1;
          maxRun = Math.max(maxRun, run);
        }
        if (maxRun >= maxRunCap) {
          penalty += ruleWeight(ctx, 'four_plus_consecutive', section, 5);
          addViolation(ctx, violations, strict_violations, 'four_plus_consecutive', section, `${a.subject_name}: 4+ ardışık slot`);
        }
      }
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
          addViolation(
            ctx,
            violations,
            strict_violations,
            'minimize_teacher_gaps',
            '',
            `Öğretmen ${userId.slice(0, 8)}: gün ${d} boşluk`,
          );
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
        'important_early',
        sec,
        `${e.subject}: geç saat (${e.lesson_num})`,
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
        addViolation(
          ctx,
          violations,
          strict_violations,
          'minimize_building_moves',
          '',
          `Bina geçişi: ${moves} kez`,
        );
      }
    }
  }

  return { penalty, violations, strict_violations };
}
