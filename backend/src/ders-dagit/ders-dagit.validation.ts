import { sectionsEquivalent } from './class-section-canonical';
import { compareClassSections, sortClassSections, sortValidationIssues } from './class-section-sort';

function weeklyHoursForSectionKey(hoursBySection: Record<string, number>, section: string): number {
  let max = 0;
  for (const [key, hrs] of Object.entries(hoursBySection)) {
    if (sectionsEquivalent(key, section)) max = Math.max(max, Number(hrs) || 0);
  }
  return max;
}

/** Yaygın doğrulama hataları — ön doğrulama */

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
  catalog_hours_by_section: Record<string, number>;
  assigned_hours_by_section: Record<string, number>;
  assignments: Array<{
    id: string;
    subject_name?: string | null;
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

/** Profillerdeki benzersiz şube sayısı (toplu tek profil dahil). */
export function countClassSectionsFromProfiles(
  profiles: Array<{ class_sections?: string[] }>,
): number {
  const set = new Set<string>();
  for (const p of profiles) {
    for (const s of p.class_sections ?? []) {
      const t = String(s).trim();
      if (t) set.add(t);
    }
  }
  return set.size;
}

export function validateStudioData(input: StudioValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const sectionCount = input.class_profiles.reduce((n, cp) => n + (cp.class_sections?.length ?? 0), 0);
  if (input.class_profiles.length === 0 || sectionCount === 0) {
    issues.push({
      code: 'MIN_CLASSES',
      severity: 'error',
      message: 'Kurulumda en az bir sınıf profili ve şube tanımlayın.',
    });
  }
  if (input.teachers.length < 2) {
    issues.push({
      code: 'MIN_TEACHERS',
      severity: 'error',
      message: 'Program üretimi için en az iki öğretmen kaydı gerekir.',
    });
  }

  const teacherLabel = (tid: string) =>
    input.teachers.find((t) => t.id === tid)?.name?.trim() || 'Öğretmen';

  const profiles = [...input.class_profiles]
    .map((cp) => ({ ...cp, class_sections: sortClassSections(cp.class_sections ?? []) }))
    .sort((a, b) => {
      const sa = a.class_sections[0] ?? a.name;
      const sb = b.class_sections[0] ?? b.name;
      return compareClassSections(sa, sb);
    });

  for (const cp of profiles) {
    const sections = cp.class_sections;
    if (sections.length === 0) {
      issues.push({
        code: 'CLASS_NO_SECTIONS',
        severity: 'warning',
        message: `${cp.name} profilinde henüz şube seçilmemiş.`,
        entity_type: 'class_profile',
        entity_id: cp.id,
      });
      continue;
    }
    const capacity = cp.max_lessons_per_day * WORK_DAYS;
    for (const sec of sections) {
      const total = weeklyHoursForSectionKey(input.assigned_hours_by_section, sec);
      const label = sec.length > 48 ? `${sec.slice(0, 45)}…` : sec;
      if (total > capacity) {
        issues.push({
          code: 'CLASS_OVER_CAPACITY',
          severity: 'warning',
          message: `${label}: haftalık ${total} saat, şube kapasitesi ${capacity} saati aşıyor.`,
          fix_hint: 'Profilde günlük ders üst sınırını artırın veya bu şubenin atama saatlerini azaltın.',
          entity_type: 'class_profile',
          entity_id: cp.id,
        });
      }
      if (cp.min_weekly_lessons != null && total < cp.min_weekly_lessons) {
        issues.push({
          code: 'CLASS_UNDER_MIN',
          severity: 'warning',
          message: `${label}: haftalık ${total} saat, minimum ${cp.min_weekly_lessons} saatin altında.`,
          entity_type: 'class_profile',
          entity_id: cp.id,
        });
      }
      if (cp.max_weekly_lessons != null && total > cp.max_weekly_lessons) {
        issues.push({
          code: 'CLASS_OVER_MAX',
          severity: 'warning',
          message: `${label}: haftalık ${total} saat, üst sınır ${cp.max_weekly_lessons} saati aşıyor.`,
          entity_type: 'class_profile',
          entity_id: cp.id,
        });
      }
    }
    for (const sec of sections) {
      const catalog = weeklyHoursForSectionKey(input.catalog_hours_by_section, sec);
      const assigned = weeklyHoursForSectionKey(input.assigned_hours_by_section, sec);
      if (catalog === 0 && assigned === 0) {
        issues.push({
          code: 'SECTION_NO_HOURS',
          severity: 'warning',
          message: `${sec} şubesi için haftalık ders saati girilmemiş.`,
          fix_hint: 'Dersler sayfasında şubeye saat ekleyin veya bu şubeye ders ataması yapın.',
        });
      }
    }
  }

  for (const [tid, h] of Object.entries(input.teacher_hours)) {
    if (h.max != null && h.assigned > h.max) {
      issues.push({
        code: 'TEACHER_OVER_MAX',
        severity: 'error',
        message: `${teacherLabel(tid)}: haftalık ${h.assigned} saat, üst sınır ${h.max} saati aşıyor.`,
      });
    }
    if (h.min != null && h.assigned < h.min) {
      issues.push({
        code: 'TEACHER_UNDER_MIN',
        severity: 'error',
        message: `${teacherLabel(tid)}: haftalık ${h.assigned} saat, zorunlu ${h.min} saatin altında.`,
      });
    }
  }

  const biweeklyByGroup: Record<string, number> = {};
  for (const a of input.assignments) {
    const assignLabel = a.subject_name?.trim() || 'Ders ataması';
    if (!a.class_sections.length) {
      issues.push({
        code: 'ASSIGN_NO_SECTION',
        severity: 'error',
        message: `${assignLabel}: şube veya sınıf seçilmemiş.`,
        entity_type: 'assignment',
        entity_id: a.id,
      });
    }
    if (a.room_ids.length === 0) {
      issues.push({
        code: 'NO_ROOMS_LIST',
        severity: 'warning',
        message: `${assignLabel}: derslik seçilmemiş (isteğe bağlı).`,
        fix_hint: 'Derslik seçmek önerilir; boş bırakılabilir.',
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
        message: 'İki haftada bir verilen derslerin toplam saati çift sayı olmalı.',
      });
    }
  }

  return sortValidationIssues(issues);
}
