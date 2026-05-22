/** Horarium yaygın hatalar (#errors) — ön doğrulama */

export type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  fix_hint?: string;
  href?: string;
  entity_type?: string;
  entity_id?: string;
};

export type StudioValidationInput = {
  class_profiles: Array<{
    id: string;
    name: string;
    class_sections: string[];
    max_lessons_per_day: number;
    min_weekly_lessons?: number | null;
    max_weekly_lessons?: number | null;
  }>;
  teachers: Array<{ id: string; name: string }>;
  subjects_by_class: Record<string, number>;
  assignments: Array<{
    id: string;
    class_sections: string[];
    weekly_hours: number;
    biweekly: boolean;
    group_id?: string | null;
    room_ids: string[];
  }>;
  groups: Array<{ id: string; abbreviation: string }>;
  teacher_hours: Record<string, { assigned: number; max?: number | null; min?: number | null }>;
};

const WORK_DAYS = 5;

export function validateStudioData(input: StudioValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.class_profiles.length < 2) {
    issues.push({ code: 'MIN_CLASSES', severity: 'error', message: 'En az iki sınıf yapılandırması gerekli.' });
  }
  if (input.teachers.length < 2) {
    issues.push({ code: 'MIN_TEACHERS', severity: 'error', message: 'En az iki öğretmen gerekli.' });
  }

  for (const cp of input.class_profiles) {
    const sections = cp.class_sections ?? [];
    if (sections.length === 0) {
      issues.push({
        code: 'CLASS_NO_SECTIONS',
        severity: 'warning',
        message: `${cp.name}: şube tanımlı değil.`,
        entity_type: 'class_profile',
        entity_id: cp.id,
      });
      continue;
    }
    const capacity = cp.max_lessons_per_day * WORK_DAYS;
    let total = 0;
    for (const sec of sections) {
      total += input.subjects_by_class[sec] ?? 0;
    }
    if (total > capacity) {
      issues.push({
        code: 'CLASS_OVER_CAPACITY',
        severity: 'error',
        message: `${cp.name}: ${total} saat > kapasite ${capacity}.`,
        fix_hint: 'Günlük max dersi artırın veya atama saatini azaltın.',
        entity_type: 'class_profile',
        entity_id: cp.id,
      });
    }
    if (cp.min_weekly_lessons != null && total < cp.min_weekly_lessons) {
      issues.push({
        code: 'CLASS_UNDER_MIN',
        severity: 'error',
        message: `${cp.name}: ${total} saat < minimum ${cp.min_weekly_lessons}.`,
        entity_type: 'class_profile',
        entity_id: cp.id,
      });
    }
    if (cp.max_weekly_lessons != null && total > cp.max_weekly_lessons) {
      issues.push({
        code: 'CLASS_OVER_MAX',
        severity: 'error',
        message: `${cp.name}: ${total} saat > maksimum ${cp.max_weekly_lessons}.`,
        entity_type: 'class_profile',
        entity_id: cp.id,
      });
    }
    for (const sec of sections) {
      if ((input.subjects_by_class[sec] ?? 0) === 0) {
        issues.push({
          code: 'SECTION_NO_HOURS',
          severity: 'warning',
          message: `${sec}: ders saati tanımlı değil.`,
        });
      }
    }
  }

  for (const [tid, h] of Object.entries(input.teacher_hours)) {
    if (h.max != null && h.assigned > h.max) {
      issues.push({
        code: 'TEACHER_OVER_MAX',
        severity: 'error',
        message: `Öğretmen ${tid}: ${h.assigned} saat > max ${h.max}.`,
      });
    }
    if (h.min != null && h.assigned < h.min) {
      issues.push({
        code: 'TEACHER_UNDER_MIN',
        severity: 'error',
        message: `Öğretmen ${tid}: ${h.assigned} saat < min ${h.min}.`,
      });
    }
  }

  const biweeklyByGroup: Record<string, number> = {};
  for (const a of input.assignments) {
    if (!a.class_sections.length) {
      issues.push({
        code: 'ASSIGN_NO_SECTION',
        severity: 'error',
        message: `Atama ${a.id.slice(0, 8)}: sınıf/şube yok.`,
        entity_type: 'assignment',
        entity_id: a.id,
      });
    }
    if (a.room_ids.length === 0) {
      issues.push({
        code: 'NO_ROOMS_LIST',
        severity: 'warning',
        message: `Atama ${a.id}: derslik listesi boş (derslik kuralı açıksa hata olur).`,
        entity_type: 'assignment',
        entity_id: a.id,
      });
    }
    if (a.biweekly && a.group_id) {
      biweeklyByGroup[a.group_id] = (biweeklyByGroup[a.group_id] ?? 0) + a.weekly_hours;
    }
  }
  for (const [gid, hrs] of Object.entries(biweeklyByGroup)) {
    if (hrs % 2 !== 0) {
      issues.push({
        code: 'BIWEEKLY_ODD',
        severity: 'error',
        message: `Grup ${gid}: iki haftada bir dersler toplamı tek sayı.`,
      });
    }
  }

  return issues;
}
