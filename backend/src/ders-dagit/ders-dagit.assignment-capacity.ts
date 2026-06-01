/** Ders ataması — sınıf / öğretmen kapasitesi uyarıları */

import {
  buildWeeklyHoursFromAssignments,
  sectionIdentityKey,
  sectionsEquivalent,
} from './class-section-canonical';

const WORK_DAYS = 5;

export type AssignmentCapacityWarning = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export function assignmentEffectiveWeeklyHours(weeklyHours: number, biweekly: boolean): number {
  const h = Math.max(1, weeklyHours);
  return biweekly ? Math.ceil(h / 2) : h;
}

export type AssignmentCapacityInput = {
  class_profiles: Array<{
    id: string;
    name: string;
    class_sections: string[];
    max_lessons_per_day: number;
    min_weekly_lessons?: number | null;
    max_weekly_lessons?: number | null;
  }>;
  teachers: Array<{
    id: string;
    name: string;
    mandatory_weekly_hours?: number | null;
    max_extra_weekly_hours?: number | null;
  }>;
  existing_assignments: Array<{
    id: string;
    subject_name?: string | null;
    class_sections: string[];
    weekly_hours: number;
    biweekly: boolean;
    teacher_ids: string[];
  }>;
  proposed: {
    exclude_assignment_id?: string | null;
    subject_name?: string | null;
    class_sections: string[];
    weekly_hours: number;
    biweekly: boolean;
    teacher_ids: string[];
  };
};

function profileForSection(
  profiles: AssignmentCapacityInput['class_profiles'],
  section: string,
): AssignmentCapacityInput['class_profiles'][0] | null {
  return profiles.find((p) => p.class_sections.some((s) => sectionsEquivalent(s, section))) ?? null;
}

function weeklyHoursForSection(hoursBySection: Record<string, number>, section: string): number {
  let max = 0;
  for (const [key, hrs] of Object.entries(hoursBySection)) {
    if (sectionsEquivalent(key, section)) max = Math.max(max, Number(hrs) || 0);
  }
  return max;
}

function teacherMaxWeekly(t: AssignmentCapacityInput['teachers'][0]): number | null {
  const mandatory = t.mandatory_weekly_hours ?? 0;
  const extra = t.max_extra_weekly_hours ?? 0;
  const max = mandatory + extra;
  return max > 0 ? max : null;
}

export function checkAssignmentCapacity(input: AssignmentCapacityInput): AssignmentCapacityWarning[] {
  const warnings: AssignmentCapacityWarning[] = [];
  const { proposed } = input;

  const assignmentRows = input.existing_assignments
    .filter((a) => !(proposed.exclude_assignment_id && a.id === proposed.exclude_assignment_id))
    .map((a) => ({
      subject_name: a.subject_name,
      class_sections: a.class_sections,
      weekly_hours: a.weekly_hours,
      biweekly: a.biweekly,
    }));

  if (proposed.class_sections.some((s) => s.trim())) {
    assignmentRows.push({
      subject_name: proposed.subject_name,
      class_sections: proposed.class_sections,
      weekly_hours: proposed.weekly_hours,
      biweekly: proposed.biweekly,
    });
  }

  const hoursBySection = buildWeeklyHoursFromAssignments(assignmentRows);
  const proposedHrs = assignmentEffectiveWeeklyHours(proposed.weekly_hours, proposed.biweekly);
  const affectedSections = [...new Set(proposed.class_sections.filter(Boolean))];

  const sectionsChecked = new Set<string>();
  for (const sec of affectedSections) {
    const identity = sectionIdentityKey(sec);
    if (sectionsChecked.has(identity)) continue;
    sectionsChecked.add(identity);

    const cp = profileForSection(input.class_profiles, sec);
    if (!cp) continue;

    const total = weeklyHoursForSection(hoursBySection, sec);
    const capacity = cp.max_lessons_per_day * WORK_DAYS;
    const label = sec.length > 48 ? `${sec.slice(0, 45)}…` : sec;

    if (total > capacity) {
      warnings.push({
        code: 'CLASS_OVER_CAPACITY',
        severity: 'error',
        message: `${label}: haftalık ${total} saat, şube kapasitesi (${cp.max_lessons_per_day}×${WORK_DAYS}=${capacity} saat) aşılıyor.`,
      });
    }
    if (cp.max_weekly_lessons != null && total > cp.max_weekly_lessons) {
      warnings.push({
        code: 'CLASS_OVER_MAX',
        severity: 'error',
        message: `${label}: haftalık ${total} saat, üst sınır ${cp.max_weekly_lessons} saati aşıyor.`,
      });
    }
    if (cp.min_weekly_lessons != null && total < cp.min_weekly_lessons) {
      warnings.push({
        code: 'CLASS_UNDER_MIN',
        severity: 'warning',
        message: `${label}: haftalık ${total} saat, minimum ${cp.min_weekly_lessons} saatin altında.`,
      });
    }
  }

  const teacherHours: Record<string, number> = {};
  for (const a of input.existing_assignments) {
    if (proposed.exclude_assignment_id && a.id === proposed.exclude_assignment_id) continue;
    const hrs = assignmentEffectiveWeeklyHours(a.weekly_hours, a.biweekly);
    for (const uid of a.teacher_ids) {
      teacherHours[uid] = (teacherHours[uid] ?? 0) + hrs;
    }
  }
  for (const uid of proposed.teacher_ids) {
    if (!uid) continue;
    teacherHours[uid] = (teacherHours[uid] ?? 0) + proposedHrs;
  }

  for (const [uid, assigned] of Object.entries(teacherHours)) {
    const t = input.teachers.find((x) => x.id === uid);
    const label = t?.name?.trim() || 'Öğretmen';
    const max = t ? teacherMaxWeekly(t) : null;
    const min = t?.mandatory_weekly_hours ?? null;
    if (max != null && assigned > max) {
      warnings.push({
        code: 'TEACHER_OVER_MAX',
        severity: 'error',
        message: `${label}: haftalık ${assigned} saat, üst sınır ${max} saati aşıyor.`,
      });
    } else if (max != null && assigned === max) {
      warnings.push({
        code: 'TEACHER_AT_MAX',
        severity: 'warning',
        message: `${label}: haftalık ${assigned} saat — üst sınıra ulaştı.`,
      });
    }
    if (min != null && assigned < min && proposed.teacher_ids.includes(uid)) {
      warnings.push({
        code: 'TEACHER_UNDER_MIN',
        severity: 'warning',
        message: `${label}: haftalık ${assigned} saat, zorunlu ${min} saatin altında (diğer atamalarla birlikte kontrol edin).`,
      });
    }
  }

  return warnings;
}
