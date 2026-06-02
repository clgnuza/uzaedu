import { sortValidationIssues } from './class-section-sort';
import {
  internshipDaysBySectionFromProfiles,
  isInternshipPlacementBlocked,
  type InternshipBlockContext,
} from './ders-dagit.internship';
import { maxLessonsForDay, type StudioPeriodConfig } from './ders-dagit.period';
import { isSectionSlotPlaceable, type SectionScheduleConfig } from './ders-dagit.section-schedule';
import type { StudioSchoolProfile } from './ders-dagit.school-profile';
import type { ValidationIssue } from './ders-dagit.validation';

type Unavail = { day_of_week: number; lesson_num?: number | null; user_id?: string | null };

export type FeasibilityInput = {
  work_days: number[];
  max_lesson_per_day: number;
  max_lesson_by_day: Map<number, number>;
  period: StudioPeriodConfig;
  school_profile: StudioSchoolProfile;
  section_schedules: Map<string, SectionScheduleConfig>;
  section_internship_from_profiles: Map<string, number[]>;
  unavailable: Unavail[];
  teachers: Array<{
    user_id: string;
    name: string;
    assigned_hours: number;
    max_per_day?: number | null;
    max_work_days?: number | null;
  }>;
  assignments: Array<{
    id: string;
    subject_name?: string | null;
    weekly_hours: number;
    biweekly: boolean;
    class_sections: string[];
    unavailable_periods: Array<{ day_of_week: number; lesson_num?: number }>;
  }>;
};

function effWeeklyHours(weekly: number, biweekly: boolean): number {
  return biweekly ? Math.ceil(weekly / 2) : weekly;
}

function isSlotBlockedForTeacher(unavailable: Unavail[], day: number, lesson: number, userId: string): boolean {
  for (const u of unavailable) {
    if (u.day_of_week !== day) continue;
    if (u.lesson_num != null && u.lesson_num !== lesson) continue;
    if (!u.user_id) return true;
    if (u.user_id === userId) return true;
  }
  return false;
}

function countTeacherOpenSlots(input: FeasibilityInput, userId: string): number {
  let n = 0;
  const t = input.teachers.find((x) => x.user_id === userId);
  const perDayCap = t?.max_per_day ?? input.max_lesson_per_day;
  for (const day of input.work_days) {
    const dayMax = Math.min(
      input.max_lesson_by_day.get(day) ?? input.max_lesson_per_day,
      perDayCap,
    );
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (!isSlotBlockedForTeacher(input.unavailable, day, lesson, userId)) n++;
    }
  }
  if (t?.max_work_days != null && t.max_work_days > 0) {
    n = Math.min(n, t.max_work_days * perDayCap);
  }
  return n;
}

function countSectionSlots(
  input: FeasibilityInput,
  section: string,
): { open: number; closed: number } {
  const sched = input.section_schedules.get(section);
  const internshipCtx: InternshipBlockContext = {
    school_profile: input.school_profile,
    section_schedules: input.section_schedules,
    section_internship_from_profiles: input.section_internship_from_profiles,
  };
  let open = 0;
  let closed = 0;
  for (const day of input.work_days) {
    const dayMax = input.max_lesson_by_day.get(day) ?? input.max_lesson_per_day;
    if (isInternshipPlacementBlocked(internshipCtx, day, section)) {
      closed += dayMax;
      continue;
    }
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (isSectionSlotPlaceable(sched, day, lesson, input.period, input.max_lesson_per_day)) open++;
      else closed++;
    }
  }
  return { open, closed };
}

function countAssignmentOpenSlots(
  input: FeasibilityInput,
  section: string,
  blocks: Array<{ day_of_week: number; lesson_num?: number }>,
): number {
  const sched = input.section_schedules.get(section);
  const internshipCtx: InternshipBlockContext = {
    school_profile: input.school_profile,
    section_schedules: input.section_schedules,
    section_internship_from_profiles: input.section_internship_from_profiles,
  };
  let n = 0;
  for (const day of input.work_days) {
    const dayMax = input.max_lesson_by_day.get(day) ?? input.max_lesson_per_day;
    if (isInternshipPlacementBlocked(internshipCtx, day, section)) continue;
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (!isSectionSlotPlaceable(sched, day, lesson, input.period, input.max_lesson_per_day)) continue;
      let blocked = false;
      for (const b of blocks) {
        if (b.day_of_week !== day) continue;
        if (b.lesson_num == null || b.lesson_num === lesson) {
          blocked = true;
          break;
        }
      }
      if (!blocked) n++;
    }
  }
  return n;
}

function sectionLabel(sec: string): string {
  return sec.length > 48 ? `${sec.slice(0, 45)}…` : sec;
}

/** Üretim öncesi: slot / kapalı saat / yoğunluk uyarıları */
export function computeFeasibilityWarnings(input: FeasibilityInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.work_days.length) return issues;

  const totalGrid = input.work_days.reduce(
    (s, d) => s + (input.max_lesson_by_day.get(d) ?? input.max_lesson_per_day),
    0,
  );

  for (const t of input.teachers) {
    if (t.assigned_hours <= 0) continue;
    const open = countTeacherOpenSlots(input, t.user_id);
    if (open <= 0) {
      issues.push({
        code: 'TEACHER_SLOTS_INSUFFICIENT',
        severity: 'warning',
        message: `${t.name}: atanmış ${t.assigned_hours} saat var; müsaitlik/nöbet sonrası açık öğretmen slotu yok.`,
        fix_hint:
          'Öğretmen müsaitliğini veya nöbet kayıtlarını gözden geçirin; dönemde çalışma günü/saat artırın.',
        entity_type: 'teacher',
        entity_id: t.user_id,
      });
      continue;
    }
    if (t.assigned_hours > open) {
      issues.push({
        code: 'TEACHER_SLOTS_INSUFFICIENT',
        severity: 'warning',
        message: `${t.name}: ${t.assigned_hours} saat atanmış, kapalı/nöbet/müsaitlik sonrası yaklaşık ${open} boş slot.`,
        fix_hint: 'Atama yükünü azaltın veya öğretmenin kullanılabilir slotlarını artırın.',
        entity_type: 'teacher',
        entity_id: t.user_id,
      });
    } else if (t.assigned_hours / open >= 0.88) {
      issues.push({
        code: 'TEACHER_SCHEDULE_TIGHT',
        severity: 'warning',
        message: `${t.name}: yük slotların %${Math.round((t.assigned_hours / open) * 100)}’i — yoğun program, yerleştirme zorlaşabilir.`,
        fix_hint: 'Kapalı saatleri veya atama saatlerini gevşetin.',
        entity_type: 'teacher',
        entity_id: t.user_id,
      });
    }
    if (totalGrid > 0) {
      const blocked = totalGrid - open;
      if (blocked / totalGrid >= 0.35 && t.assigned_hours >= 8) {
        issues.push({
          code: 'TEACHER_HIGH_UNAVAILABLE',
          severity: 'warning',
          message: `${t.name}: haftalık ızgaranın ~%${Math.round((blocked / totalGrid) * 100)}’i kapalı (nöbet/müsaitlik).`,
          fix_hint: 'Öğretmen müsaitliği veya nöbet planını kontrol edin.',
          entity_type: 'teacher',
          entity_id: t.user_id,
        });
      }
    }
  }

  const hoursBySection = new Map<string, number>();
  for (const a of input.assignments) {
    const hrs = effWeeklyHours(a.weekly_hours, a.biweekly);
    for (const sec of a.class_sections) {
      const s = sec.trim();
      if (!s) continue;
      hoursBySection.set(s, (hoursBySection.get(s) ?? 0) + hrs);
    }
  }

  for (const [sec, hours] of hoursBySection) {
    const { open, closed } = countSectionSlots(input, sec);
    const label = sectionLabel(sec);
    if (hours > open) {
      issues.push({
        code: 'SECTION_SLOTS_INSUFFICIENT',
        severity: 'warning',
        message: `${label}: ${hours} saat gerekli, yerleştirilebilir şube slotu ${open} (${closed} kapalı/staj).`,
        fix_hint: 'Sınıf saatleri tablosunda kapalı hücreleri açın veya atama saatini düşürün.',
      });
    } else if (closed > 0 && open > 0 && hours / open >= 0.85) {
      issues.push({
        code: 'SECTION_SCHEDULE_TIGHT',
        severity: 'warning',
        message: `${label}: ${closed} kapalı/staj hücresi — ${hours} saat / ${open} açık slot (yoğun).`,
        fix_hint: 'Şube zaman çizelgesinde kapalı günleri azaltın.',
      });
    }
  }

  for (const a of input.assignments) {
    const blocks = a.unavailable_periods ?? [];
    if (!blocks.length) continue;
    const hrs = effWeeklyHours(a.weekly_hours, a.biweekly);
    const sec = a.class_sections.find((s) => s.trim())?.trim();
    if (!sec) continue;
    const feasible = countAssignmentOpenSlots(input, sec, blocks);
    const label = a.subject_name?.trim() || 'Ders ataması';
    if (hrs > feasible) {
      issues.push({
        code: 'ASSIGN_SLOTS_BLOCKED',
        severity: 'warning',
        message: `${label}: atamada ${blocks.length} kapalı kural — şubede yalnızca ~${feasible} slot uygun (${hrs} saat gerekli).`,
        fix_hint: 'Atamadaki kapalı saatleri azaltın veya şube kapasitesini artırın.',
        entity_type: 'assignment',
        entity_id: a.id,
      });
    }
  }

  return sortValidationIssues(issues);
}

/** runValidation içinde max_lesson_by_day üretimi */
export function buildMaxLessonByDay(
  work_days: number[],
  period: StudioPeriodConfig,
  max_lesson_per_day: number,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const d of work_days) {
    map.set(d, maxLessonsForDay(period, d, max_lesson_per_day));
  }
  return map;
}
