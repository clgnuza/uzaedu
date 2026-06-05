import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import { placementBlocked } from './ders-dagit.solver-placement-rules';
import { ruleOnForAssignment } from './ders-dagit.solver-rule-scope';
import type { DersDagitGroupMode } from './ders-dagit.groups';
import { assignmentBlockLessons, type StudioSchoolProfile } from './ders-dagit.school-profile';
import { isInternshipPlacementBlocked } from './ders-dagit.internship';
import { assignmentBlockPlacementOk, assignmentPlacementSpec } from './ders-dagit.assignment-blocks';
import { daysForAssignment } from './ders-dagit.solver-blocks';
import {
  placementPatternForAssignment,
  placeByDayDistributionBestPermutation,
  placeRemainingPatternChunks,
} from './ders-dagit.solver-distribution';
import {
  shouldEnforceDistributionPattern,
  type DistributionPolicy,
} from './ders-dagit.distribution-policy';
import { assignmentHasStoredDistribution } from './ders-dagit.day-distribution';
import { appendMinDaysViolationIfNeeded } from './ders-dagit.min-days';
import { lessonInShift, type EducationShift } from './ders-dagit.dual-education';
import {
  isSectionSlotPlaceable,
  maxLessonsForSectionDay,
  type SectionScheduleConfig,
} from './ders-dagit.section-schedule';
import type { StudioPeriodConfig } from './ders-dagit.period';

/**
 * Kısıtlı yerleştirme — sert: çakışma, müsait değil, öğretmen limitleri.
 * Yumuşak skor: kural ağırlıkları (ders-dagit.solver-rules).
 */

export type SolverSlot = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  user_id: string | null;
  assignment_id: string;
  room_id: string | null;
  group_id: string | null;
};

export type SolverAssignment = {
  id: string;
  class_sections: string[];
  subject_id?: string | null;
  subject_name: string;
  weekly_hours: number;
  teacher_ids: string[];
  group_id: string | null;
  room_ids: string[];
  max_per_day: number | null;
  min_days_per_week: number | null;
  fixed_slots: Array<{ day_of_week: number; lesson_num: number; class_section?: string }>;
  place_first: boolean;
  biweekly?: boolean;
  max_days_per_week?: number | null;
  unavailable_periods?: Array<{ day_of_week: number; lesson_num?: number }>;
  co_teach?: boolean;
  options?: Record<string, unknown>;
};

export type RoomConstraint = {
  subjects: string[] | null;
  sections: string[] | null;
  teachers: string[] | null;
};

export type UnavailableSlot = {
  day_of_week: number;
  lesson_num: number | null;
  user_id?: string | null;
};

export type RuleState = Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }>;

export type TeacherLimit = {
  user_id: string;
  max_per_day: number | null;
  max_weekly: number | null;
  min_weekly: number | null;
  min_work_days: number | null;
  max_work_days: number | null;
  allow_am_pm_gap: boolean;
};

export type SolverContext = {
  max_lesson_per_day: number;
  work_days: number[];
  unavailable: UnavailableSlot[];
  /** Grup paralel / alt şube — aynı slot ankrajı */
  parallel_groups: Set<string>;
  group_modes: Map<string, DersDagitGroupMode>;
  day_order?: number[];
  /** Yerleştirme deneme sırası stratejisi (varyasyon üretimi için). */
  assignment_order?: 'default' | 'hardest_first' | 'most_hours' | 'fewest_slots' | 'random';
  active_rules: RuleState;
  teacher_limits: TeacherLimit[];
  room_required: boolean;
  room_building: Map<string, string | null>;
  building_travel_gap: number;
  no_building_same_day: boolean;
  /** Öğle arası vb. — bu ders sırasına ders konmaz */
  blocked_lesson_nums: Set<number>;
  /** Gün → max ders sırası */
  max_lesson_by_day: Map<number, number>;
  /** Öğle arası: bu dersten sonraki slotlar PM sayılır */
  lunch_after_lesson: number;
  room_constraints: Map<string, RoomConstraint>;
  building_travel_matrix: Map<string, number>;
  school_profile: StudioSchoolProfile;
  dual_education_enabled: boolean;
  pm_first_lesson: number;
  section_shift: Map<string, EducationShift | null>;
  teacher_shift: Map<string, EducationShift | null>;
  group_member_sections: Map<string, string[]>;
  /** Şube → etkin kural seti (profil özelleştirmesi) */
  section_rules: Map<string, RuleState>;
  /** Şube → slot ızgarası (kapalı / staj / günlük max) */
  section_schedules: Map<string, SectionScheduleConfig>;
  section_internship_from_profiles: Map<string, number[]>;
  studio_period: StudioPeriodConfig;
  strict_rule_keys_global?: Set<string>;
  strict_rule_keys_by_section?: Map<string, Set<string>>;
  planning_relations?: import('./ders-dagit.planning-relations').PlanningRelationRow[];
  assignment_subjects?: Map<string, string | null>;
  distribution_policy?: DistributionPolicy;
  /** Tek üretimde desen + kurallar gevşetildi (kalıcı ayar değil). */
  relax_constraints?: boolean;
};

export function rulesForSection(ctx: SolverContext, section: string): RuleState {
  return ctx.section_rules.get(section) ?? ctx.active_rules;
}

function effectiveWeeklyHours(a: SolverAssignment): number {
  return a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
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

export type SolverResult = {
  entries: SolverSlot[];
  placed: number;
  failed: number;
  violations: string[];
  score: number;
};

function slotKey(day: number, lesson: number): string {
  return `${day}:${lesson}`;
}

function isUnavailable(ctx: SolverContext, day: number, lesson: number, userId: string | null): boolean {
  for (const u of ctx.unavailable) {
    if (u.day_of_week !== day) continue;
    if (u.lesson_num != null && u.lesson_num !== lesson) continue;
    if (u.user_id && userId && u.user_id !== userId) continue;
    if (!u.user_id && userId) continue;
    return true;
  }
  return false;
}

export function canPlace(
  occupied: Map<string, SolverSlot[]>,
  day: number,
  lesson: number,
  classSection: string,
  userId: string | null,
  ctx: SolverContext,
  assignment: SolverAssignment,
): boolean {
  const secSched = ctx.section_schedules.get(classSection);
  const dayMax = secSched
    ? maxLessonsForSectionDay(secSched, day, ctx.studio_period, ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day)
    : ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
  if (lesson < 1 || lesson > dayMax) return false;
  if (!isSectionSlotPlaceable(secSched, day, lesson, ctx.studio_period, ctx.max_lesson_per_day)) return false;
  if (!ctx.work_days.includes(day)) return false;
  if (
    isInternshipPlacementBlocked(
      {
        school_profile: ctx.school_profile,
        section_schedules: ctx.section_schedules,
        section_internship_from_profiles: ctx.section_internship_from_profiles,
      },
      day,
      classSection,
    )
  )
    return false;
  if (ctx.dual_education_enabled) {
    const secShift = ctx.section_shift.get(classSection) ?? null;
    if (!lessonInShift(lesson, secShift, ctx.pm_first_lesson)) return false;
    if (userId) {
      const tShift = ctx.teacher_shift.get(userId) ?? null;
      if (!lessonInShift(lesson, tShift, ctx.pm_first_lesson)) return false;
    }
  }
  if (userId && isUnavailable(ctx, day, lesson, userId)) return false;

  const mode = assignment.group_id ? ctx.group_modes.get(assignment.group_id) : undefined;
  const key = slotKey(day, lesson);
  const existing = occupied.get(key) ?? [];
  for (const e of existing) {
    if (e.class_section === classSection) {
      if (assignment.co_teach && e.assignment_id === assignment.id) continue;
      return false;
    }
    if (userId && e.user_id && e.user_id === userId) {
      const sameGroup = assignment.group_id && e.group_id === assignment.group_id;
      if (sameGroup && mode === 'teacher_multi_class') continue;
      if (sameGroup && mode === 'subgroups' && e.class_section !== classSection) continue;
      return false;
    }
    if (mode === 'parallel_rooms' && assignment.group_id && e.group_id === assignment.group_id) {
      continue;
    }
  }
  return true;
}

function countAssignmentOnDay(entries: SolverSlot[], assignmentId: string, day: number): number {
  const lessons = new Set<number>();
  for (const e of entries) {
    if (e.assignment_id === assignmentId && e.day_of_week === day) lessons.add(e.lesson_num);
  }
  return lessons.size;
}

function countTeacherOnDay(entries: SolverSlot[], userId: string, day: number): number {
  return entries.filter((e) => e.user_id === userId && e.day_of_week === day).length;
}

function countTeacherWeek(entries: SolverSlot[], userId: string): number {
  return entries.filter((e) => e.user_id === userId).length;
}

function teacherLimit(ctx: SolverContext, userId: string | null): TeacherLimit | null {
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
    const ePm = isPmLesson(ctx, e.lesson_num);
    if (addingPm !== ePm) return true;
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

function daysUsed(entries: SolverSlot[], assignmentId: string): Set<number> {
  const s = new Set<number>();
  for (const e of entries) {
    if (e.assignment_id === assignmentId) s.add(e.day_of_week);
  }
  return s;
}

function orderedDays(ctx: SolverContext): number[] {
  const base = ctx.work_days.length ? ctx.work_days : [1, 2, 3, 4, 5];
  if (!ctx.day_order?.length) return base;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const d of ctx.day_order) {
    if (base.includes(d) && !seen.has(d)) {
      out.push(d);
      seen.add(d);
    }
  }
  for (const d of base) {
    if (!seen.has(d)) out.push(d);
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Bir atamanın kabaca "zorluğu" — yüksek = daha kısıtlı, önce denenmeli. */
function assignmentDifficulty(a: SolverAssignment, ctx: SolverContext): number {
  const hours = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
  const teacherChoices = Math.max(1, a.teacher_ids.length);
  const blockedSlots = a.unavailable_periods?.length ?? 0;
  const perDayCap = a.max_per_day ?? ctx.max_lesson_per_day;
  const fixedBoost = (a.fixed_slots?.length ?? 0) > 0 ? 30 : 0;
  const blockBoost = ((a.options?.block_lessons as number | undefined) ?? 1) > 1 ? 15 : 0;
  const distBoost =
    shouldEnforceDistributionPattern(ctx.distribution_policy) &&
    (assignmentHasStoredDistribution(a.options) ||
      placementPatternForAssignment(a, hours, ctx))
      ? 25
      : 0;
  return (
    hours * 4 +
    blockedSlots * 3 +
    fixedBoost +
    blockBoost +
    distBoost +
    (a.min_days_per_week ?? 0) * 2 -
    teacherChoices * 2 -
    perDayCap
  );
}

/** place_first her zaman önde; ardından seçilen stratejiye göre sıralanır. */
function orderAssignmentsForSolve(
  assignments: SolverAssignment[],
  ctx: SolverContext,
): SolverAssignment[] {
  const strat = ctx.assignment_order ?? 'default';
  const list = [...assignments];
  const cmpHours = (a: SolverAssignment) =>
    a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
  switch (strat) {
    case 'random':
      shuffleInPlace(list);
      break;
    case 'hardest_first':
      list.sort((a, b) => assignmentDifficulty(b, ctx) - assignmentDifficulty(a, ctx));
      break;
    case 'most_hours':
      list.sort((a, b) => cmpHours(b) - cmpHours(a));
      break;
    case 'fewest_slots':
      list.sort(
        (a, b) =>
          (a.teacher_ids.length || 99) - (b.teacher_ids.length || 99) ||
          cmpHours(b) - cmpHours(a),
      );
      break;
    default:
      break;
  }
  return list.sort((a, b) => (b.place_first ? 1 : 0) - (a.place_first ? 1 : 0));
}

export function runConstraintSolver(
  assignments: SolverAssignment[],
  ctx: SolverContext,
): SolverResult {
  const entries: SolverSlot[] = [];
  const occupied = new Map<string, SolverSlot[]>();
  const violations: string[] = [];
  const days = orderedDays(ctx);

  const sorted = orderAssignmentsForSolve(assignments, ctx);

  const placeOne = (
    a: SolverAssignment,
    classSection: string,
    day: number,
    lesson: number,
    userId: string | null,
  ): boolean => {
    if (!canPlace(occupied, day, lesson, classSection, userId, ctx, a)) return false;
    if (a.max_per_day != null && countAssignmentOnDay(entries, a.id, day) >= a.max_per_day) return false;
    if (ctx.room_required && !a.room_ids.length) return false;

    const lim = teacherLimit(ctx, userId);
    if (lim?.max_per_day != null && userId && countTeacherOnDay(entries, userId, day) >= lim.max_per_day) {
      return false;
    }
    if (lim?.max_weekly != null && userId && countTeacherWeek(entries, userId) >= lim.max_weekly) {
      return false;
    }
    if (userId && lim?.max_work_days != null) {
      const days = teacherWorkDays(entries, userId);
      if (!days.has(day) && days.size >= lim.max_work_days) return false;
    }
    if (userId && violatesAmPmGap(entries, ctx, userId, day, lesson)) return false;

    const room_id = a.room_ids[0] ?? null;
    if (!roomAllows(ctx, room_id, a, userId, classSection)) return false;
    if (placementBlocked(entries, ctx, a, day, lesson, userId)) return false;
    if (violatesBuildingRules(entries, ctx, userId, day, lesson, room_id)) return false;
    const placeSpec = assignmentPlacementSpec(a.options, a.weekly_hours, a.biweekly);
    if (!assignmentBlockPlacementOk(entries, a.id, undefined, day, lesson, placeSpec)) return false;
    const slot: SolverSlot = {
      day_of_week: day,
      lesson_num: lesson,
      class_section: classSection,
      subject: a.subject_name,
      user_id: userId,
      assignment_id: a.id,
      room_id,
      group_id: a.group_id,
    };
    entries.push(slot);
    const key = slotKey(day, lesson);
    const arr = occupied.get(key) ?? [];
    arr.push(slot);
    occupied.set(key, arr);
    if (a.co_teach && userId) {
      for (const coId of a.teacher_ids) {
        if (coId === userId) continue;
        if (!canPlace(occupied, day, lesson, classSection, coId, ctx, a)) continue;
        const coSlot: SolverSlot = {
          day_of_week: day,
          lesson_num: lesson,
          class_section: classSection,
          subject: a.subject_name,
          user_id: coId,
          assignment_id: a.id,
          room_id,
          group_id: a.group_id,
        };
        entries.push(coSlot);
        arr.push(coSlot);
      }
      occupied.set(key, arr);
    }
    return true;
  };

  /** Paralel grup: ilk atanan slotu diğer atamalara kopyala */
  const groupAnchor = new Map<string, { day: number; lesson: number }>();

  for (const a of sorted) {
    for (const fix of a.fixed_slots ?? []) {
      const sec = fix.class_section ?? a.class_sections[0];
      if (!sec) continue;
      const uid = a.teacher_ids[0] ?? null;
      if (placeOne(a, sec, fix.day_of_week, fix.lesson_num, uid)) {
        if (a.group_id && ctx.parallel_groups.has(a.group_id)) {
          groupAnchor.set(a.group_id, { day: fix.day_of_week, lesson: fix.lesson_num });
        }
      } else {
        violations.push(`Sabit slot yerleşmedi: ${a.subject_name} ${sec}`);
      }
    }
  }

  for (const a of sorted) {
    const fixedUsed = (a.fixed_slots ?? []).length;
    let need = Math.max(0, effectiveWeeklyHours(a) - fixedUsed);
    const uid = a.teacher_ids[0] ?? null;

    if (a.group_id && groupAnchor.has(a.group_id)) {
      const anchor = groupAnchor.get(a.group_id)!;
      for (const sec of a.class_sections) {
        if (placeOne(a, sec, anchor.day, anchor.lesson, uid)) need--;
      }
      continue;
    }

    const gMode = a.group_id ? ctx.group_modes.get(a.group_id) : undefined;
    const subgroupSecs =
      gMode === 'subgroups' && a.group_id
        ? (ctx.group_member_sections.get(a.group_id) ?? a.class_sections)
        : a.class_sections;
    if (gMode === 'subgroups' && subgroupSecs.length > 1) {
      let placedBlock = false;
      outerSub: for (const day of days) {
        const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
        for (let lesson = 1; lesson <= dayMax; lesson++) {
          if (ctx.blocked_lesson_nums.has(lesson)) continue;
          const ok = subgroupSecs.every((sec) => canPlace(occupied, day, lesson, sec, uid, ctx, a));
          if (!ok) continue;
          if (a.max_per_day != null && countAssignmentOnDay(entries, a.id, day) + subgroupSecs.length > a.max_per_day) {
            continue;
          }
          for (const sec of subgroupSecs) {
            placeOne(a, sec, day, lesson, uid);
          }
          need -= subgroupSecs.length;
          placedBlock = true;
          if (a.group_id) groupAnchor.set(a.group_id, { day, lesson });
          break outerSub;
        }
      }
      if (placedBlock && need <= 0) continue;
    }
    if (gMode === 'teacher_multi_class' && a.class_sections.length > 1) {
      let placedBlock = false;
      outer: for (const day of days) {
        const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
        for (let lesson = 1; lesson <= dayMax; lesson++) {
          if (ctx.blocked_lesson_nums.has(lesson)) continue;
          const ok = a.class_sections.every((sec) =>
            canPlace(occupied, day, lesson, sec, uid, ctx, a),
          );
          if (!ok) continue;
          if (a.max_per_day != null && countAssignmentOnDay(entries, a.id, day) + a.class_sections.length > a.max_per_day) {
            continue;
          }
          for (const sec of a.class_sections) {
            placeOne(a, sec, day, lesson, uid);
          }
          need -= a.class_sections.length;
          placedBlock = true;
          break outer;
        }
      }
      if (placedBlock && need <= 0) continue;
    }

    const effTotal = effectiveWeeklyHours(a);
    const distPattern = placementPatternForAssignment(a, effTotal, ctx);
    if (distPattern?.length) {
      const distPlaced = placeByDayDistributionBestPermutation(
        a,
        need,
        distPattern,
        uid,
        days,
        ctx,
        entries,
        occupied,
        placeOne,
        canPlace,
        effTotal,
      );
      need -= distPlaced;
      if (need <= 0) {
        appendMinDaysViolationIfNeeded(violations, a, entries, ctx.distribution_policy, distPattern);
        continue;
      }
      const chunkPlaced = placeRemainingPatternChunks(
        a,
        need,
        distPattern,
        uid,
        days,
        ctx,
        entries,
        occupied,
        placeOne,
        canPlace,
        effTotal,
      );
      need -= chunkPlaced;
      if (need <= 0) {
        appendMinDaysViolationIfNeeded(violations, a, entries, ctx.distribution_policy, distPattern);
        continue;
      }
    }

    const usedDays = daysUsed(entries, a.id);
    const minDays = a.min_days_per_week ?? 1;
    const dayScores = (d: number) => {
      const onDay = countAssignmentOnDay(entries, a.id, d);
      const isNewDay = usedDays.has(d) ? 0 : 1;
      const needSpread = usedDays.size < minDays ? -2 : 0;
      return onDay * 10 - isNewDay * 5 + needSpread;
    };
    const dayTry = daysForAssignment(a, [...days].sort((x, y) => dayScores(x) - dayScores(y)));

    const blockSize = assignmentBlockLessons(a.options);
    if (blockSize > 1 && need > 0) {
      outerBlock: for (const day of dayTry) {
        const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
        for (let start = 1; start <= dayMax - blockSize + 1; start++) {
          if (ctx.blocked_lesson_nums.has(start)) continue;
          for (const sec of a.class_sections) {
            let ok = true;
            for (let i = 0; i < blockSize; i++) {
              const les = start + i;
              if (!canPlace(occupied, day, les, sec, uid, ctx, a)) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;
            if (a.max_per_day != null && countAssignmentOnDay(entries, a.id, day) + blockSize > a.max_per_day) {
              continue;
            }
            for (let i = 0; i < blockSize; i++) {
              placeOne(a, sec, day, start + i, uid);
              need--;
              usedDays.add(day);
            }
            if (need <= 0) break outerBlock;
          }
        }
        if (need <= 0) break;
      }
    }

    const keepBlockPattern =
      !!distPattern?.length &&
      (assignmentHasStoredDistribution(a.options) ||
        shouldEnforceDistributionPattern(ctx.distribution_policy));
    if (need > 0 && keepBlockPattern && distPattern) {
      need -= placeRemainingPatternChunks(
        a,
        need,
        distPattern,
        uid,
        days,
        ctx,
        entries,
        occupied,
        placeOne,
        canPlace,
        effTotal,
      );
      if (blockSize > 1 && need > 0) {
        outerBlock2: for (const day of dayTry) {
          const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
          for (let start = 1; start <= dayMax - blockSize + 1; start++) {
            if (ctx.blocked_lesson_nums.has(start)) continue;
            for (const sec of a.class_sections) {
              let ok = true;
              for (let i = 0; i < blockSize; i++) {
                if (!canPlace(occupied, day, start + i, sec, uid, ctx, a)) {
                  ok = false;
                  break;
                }
              }
              if (!ok) continue;
              if (countAssignmentOnDay(entries, a.id, day) + blockSize > (a.max_per_day ?? 8)) continue;
              for (let i = 0; i < blockSize; i++) {
                placeOne(a, sec, day, start + i, uid);
                need--;
              }
              if (need <= 0) break outerBlock2;
            }
          }
          if (need <= 0) break;
        }
      }
    }
    let attempts = 0;
    const maxAttempts = days.length * ctx.max_lesson_per_day * 4;
    while (need > 0 && !keepBlockPattern && attempts < maxAttempts) {
      attempts++;
      let placed = false;
      for (const day of dayTry) {
        const dayMax = ctx.max_lesson_by_day.get(day) ?? ctx.max_lesson_per_day;
        const preferEarly = a.class_sections.some((sec) =>
          ruleOnForAssignment(ctx, 'important_early', sec, a),
        );
        const lessonOrder = preferEarly
          ? Array.from({ length: dayMax }, (_, i) => i + 1).filter((n) => !ctx.blocked_lesson_nums.has(n))
          : Array.from({ length: dayMax }, (_, i) => dayMax - i).filter((n) => !ctx.blocked_lesson_nums.has(n));
        for (const lesson of lessonOrder) {
          for (const sec of a.class_sections) {
            if (placeOne(a, sec, day, lesson, uid)) {
              need--;
              usedDays.add(day);
              placed = true;
              if (a.group_id && ctx.parallel_groups.has(a.group_id)) {
                groupAnchor.set(a.group_id, { day, lesson });
              }
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;
      }
      if (!placed) break;
    }
    appendMinDaysViolationIfNeeded(
      violations,
      a,
      entries,
      ctx.distribution_policy,
      placementPatternForAssignment(a, effTotal, ctx),
    );
    if (need > 0) {
      const hint = blockSize > 1 ? ' (blok ders?)' : '';
      violations.push(`${a.subject_name}: ${need} saat yerleşmedi${hint}`);
    }
  }

  let clashCount = 0;
  for (const [, slots] of occupied) {
    const teachers = new Set(slots.map((s) => s.user_id).filter(Boolean));
    const classes = new Set(slots.map((s) => s.class_section));
    const gid = slots[0]?.group_id;
    const gMode = gid ? ctx.group_modes.get(gid) : undefined;
    const subgroupOk = gMode === 'subgroups' && gid && slots.every((s) => s.group_id === gid);
    if (!subgroupOk && teachers.size < slots.filter((s) => s.user_id).length) clashCount++;
    if (classes.size < slots.length && !subgroupOk) clashCount++;
  }

  for (const lim of ctx.teacher_limits) {
    const days = teacherWorkDays(entries, lim.user_id);
    if (lim.min_work_days != null && days.size < lim.min_work_days) {
      violations.push(`Öğretmen ${lim.user_id.slice(0, 8)}: min ${lim.min_work_days} çalışma günü (şu an ${days.size})`);
    }
    if (lim.max_work_days != null && days.size > lim.max_work_days) {
      violations.push(`Öğretmen ${lim.user_id.slice(0, 8)}: max ${lim.max_work_days} çalışma günü`);
    }
    if (lim.min_weekly != null) {
      const n = countTeacherWeek(entries, lim.user_id);
      if (n < lim.min_weekly) {
        violations.push(`Öğretmen ${lim.user_id.slice(0, 8)}: min ${lim.min_weekly} saat/hafta`);
      }
    }
  }

  const soft = applySoftRulePenalties(entries, assignments, ctx);
  violations.push(...soft.violations);

  const target = assignments.reduce(
    (s, a) => s + (a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours),
    0,
  );
  const failed = Math.max(0, target - entries.length);
  const score = Math.round(
    Math.max(
      0,
      100 -
        failed * 3 -
        violations.length * 2 -
        clashCount * 10 -
        soft.penalty -
        soft.strict_violations.length * 50,
    ),
  );

  return { entries, placed: entries.length, failed, violations, score };
}

/** @deprecated use runConstraintSolver */
export function runGreedySolver(
  assignments: SolverAssignment[],
  ctx: SolverContext,
): { entries: SolverSlot[]; placed: number; failed: number } {
  const r = runConstraintSolver(assignments, ctx);
  return { entries: r.entries, placed: r.placed, failed: r.failed };
}
