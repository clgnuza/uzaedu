import {
  assignmentEffectiveWeeklyHours,
  buildWeeklyHoursFromAssignments,
  effectiveAssignmentWeeklyHours,
  sectionsMatch,
} from '@/lib/class-section-canonical';
import type { LessonAssignmentRow } from '@/lib/lesson-assignment';

const WORK_DAYS = 5;

export type ClassProfileCapacity = {
  id?: string;
  name: string;
  class_sections: string[];
  max_lessons_per_day: number;
  max_weekly_lessons?: number | null;
  min_weekly_lessons?: number | null;
};

export type ClassCapacityWarning = {
  code: 'CLASS_OVER_CAPACITY' | 'CLASS_OVER_MAX' | 'CLASS_UNDER_MIN';
  severity: 'error' | 'warning';
  message: string;
  profileName: string;
  assignedHours: number;
  limitHours: number;
};

export { assignmentEffectiveWeeklyHours, effectiveAssignmentWeeklyHours };

export type AssignedLessonsSummary = {
  count: number;
  totalHours: number;
  subjectCount: number;
  sectionCount: number;
  withoutTeacher: number;
  withoutRoom: number;
  biweeklyCount: number;
  sectionHours: number | null;
  planHours: number | null;
  planDelta: number | null;
  weeklyLimit: number | null;
  capacityWarnings: ClassCapacityWarning[];
};

export function buildHoursBySection(rows: LessonAssignmentRow[]): Record<string, number> {
  return buildWeeklyHoursFromAssignments(
    rows.map((r) => ({
      subject_name: r.subject_name,
      class_sections: r.class_sections,
      weekly_hours: r.weekly_hours,
      biweekly: r.biweekly,
    })),
  );
}

function assignedHoursForSection(hoursBySection: Record<string, number>, section: string): number {
  let max = 0;
  for (const [key, hrs] of Object.entries(hoursBySection)) {
    if (sectionsMatch(key, section)) max = Math.max(max, Number(hrs) || 0);
  }
  return max;
}

function sectionLabel(sec: string): string {
  return sec.length > 48 ? `${sec.slice(0, 45)}…` : sec;
}

function collectSectionsForCapacityCheck(
  hoursBySection: Record<string, number>,
  profiles: ClassProfileCapacity[],
  focus?: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (sec: string) => {
    const t = sec.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (focus) {
    add(focus);
    for (const cp of profiles) {
      for (const s of cp.class_sections) {
        if (sectionsMatch(s, focus)) add(s);
      }
    }
    return out;
  }
  for (const [key, hrs] of Object.entries(hoursBySection)) {
    if (hrs > 0) add(key);
  }
  for (const cp of profiles) {
    for (const s of cp.class_sections) add(s);
  }
  return out;
}

export function checkClassCapacityWarnings(
  hoursBySection: Record<string, number>,
  profiles: ClassProfileCapacity[],
  opts?: { focusSection?: string },
): ClassCapacityWarning[] {
  const warnings: ClassCapacityWarning[] = [];
  const focus = opts?.focusSection?.trim();
  const checked = new Set<string>();

  for (const sec of collectSectionsForCapacityCheck(hoursBySection, profiles, focus || undefined)) {
    const cp = profiles.find((p) => p.class_sections.some((s) => sectionsMatch(s, sec)));
    if (!cp) continue;
    const identity = `${cp.id ?? cp.name}\0${sec}`;
    if (checked.has(identity)) continue;
    checked.add(identity);

    const total = assignedHoursForSection(hoursBySection, sec);
    if (total <= 0) continue;

    const capacity = cp.max_lessons_per_day * WORK_DAYS;
    const label = sectionLabel(sec);
    if (total > capacity) {
      warnings.push({
        code: 'CLASS_OVER_CAPACITY',
        severity: 'error',
        profileName: cp.name,
        assignedHours: total,
        limitHours: capacity,
        message: `${label}: ${total} saat/hafta, şube kapasitesi ${capacity} saati (${cp.max_lessons_per_day}×${WORK_DAYS}) aşıyor.`,
      });
    }
    if (cp.max_weekly_lessons != null && total > cp.max_weekly_lessons) {
      warnings.push({
        code: 'CLASS_OVER_MAX',
        severity: 'error',
        profileName: cp.name,
        assignedHours: total,
        limitHours: cp.max_weekly_lessons,
        message: `${label}: ${total} saat/hafta, üst sınır ${cp.max_weekly_lessons} saati aşıyor.`,
      });
    }
    if (cp.min_weekly_lessons != null && total < cp.min_weekly_lessons) {
      warnings.push({
        code: 'CLASS_UNDER_MIN',
        severity: 'warning',
        profileName: cp.name,
        assignedHours: total,
        limitHours: cp.min_weekly_lessons,
        message: `${label}: ${total} saat/hafta, minimum ${cp.min_weekly_lessons} saatin altında.`,
      });
    }
  }

  return warnings;
}

export type SectionAssignmentStatus = {
  assignedHours: number;
  weeklyLimit: number | null;
  tone: AssignedLessonsStatusTone;
  label: string;
  title?: string;
};

function weeklyLimitForSection(
  profiles: ClassProfileCapacity[],
  section: string,
): number | null {
  const cp = profiles.find((p) => p.class_sections.some((s) => sectionsMatch(s, section)));
  if (!cp) return null;
  const cap = cp.max_lessons_per_day * WORK_DAYS;
  if (cp.max_weekly_lessons != null) return Math.min(cap, cp.max_weekly_lessons);
  return cap;
}

export function sectionAssignmentStatus(
  section: string,
  hoursBySection: Record<string, number>,
  profiles: ClassProfileCapacity[],
): SectionAssignmentStatus {
  const assignedHours = assignedHoursForSection(hoursBySection, section);
  const weeklyLimit = weeklyLimitForSection(profiles, section);
  const cp = profiles.find((p) => p.class_sections.some((s) => sectionsMatch(s, section)));

  if (!cp) {
    if (assignedHours === 0) {
      return { assignedHours: 0, weeklyLimit: null, tone: 'neutral', label: '—' };
    }
    return {
      assignedHours,
      weeklyLimit: null,
      tone: 'neutral',
      label: 'Profil yok',
      title: 'Kurulumda sınıf profiline ekleyin',
    };
  }

  const capacity = cp.max_lessons_per_day * WORK_DAYS;
  const effectiveLimit = weeklyLimit ?? capacity;
  const label = sectionLabel(section);

  if (assignedHours > capacity) {
    return {
      assignedHours,
      weeklyLimit: effectiveLimit,
      tone: 'error',
      label: `+${assignedHours - capacity} aşım`,
      title: `${label}: ${assignedHours} saat, kapasite ${capacity} saat`,
    };
  }
  if (cp.max_weekly_lessons != null && assignedHours > cp.max_weekly_lessons) {
    return {
      assignedHours,
      weeklyLimit: effectiveLimit,
      tone: 'error',
      label: `+${assignedHours - cp.max_weekly_lessons} aşım`,
      title: `${label}: üst sınır ${cp.max_weekly_lessons} saat`,
    };
  }
  if (cp.min_weekly_lessons != null && assignedHours < cp.min_weekly_lessons) {
    return {
      assignedHours,
      weeklyLimit: effectiveLimit,
      tone: assignedHours === 0 ? 'neutral' : 'warn',
      label: assignedHours === 0 ? 'Atama yok' : 'Eksik',
      title: `${label}: min ${cp.min_weekly_lessons} saat`,
    };
  }
  if (assignedHours === 0) {
    return {
      assignedHours: 0,
      weeklyLimit: effectiveLimit,
      tone: 'neutral',
      label: 'Atama yok',
    };
  }
  return {
    assignedHours,
    weeklyLimit: effectiveLimit,
    tone: 'ok',
    label: 'Uygun',
    title: `${label}: ${assignedHours} saat/hafta`,
  };
}

export function computeAssignedLessonsSummary(
  rows: LessonAssignmentRow[],
  opts?: {
    filterSection?: string;
    catalogPlanHours?: number | null;
    capacityRows?: LessonAssignmentRow[];
    classProfiles?: ClassProfileCapacity[];
  },
): AssignedLessonsSummary {
  const filterSection = opts?.filterSection?.trim() || '';
  const subjects = new Set<string>();
  const sections = new Set<string>();
  let totalHours = 0;
  let sectionHours = 0;
  let withoutTeacher = 0;
  let withoutRoom = 0;
  let biweeklyCount = 0;

  for (const r of rows) {
    const eff = assignmentEffectiveWeeklyHours(r.weekly_hours, r.biweekly);
    const secs = r.class_sections ?? [];
    const matchesSection =
      !filterSection || secs.some((s) => sectionsMatch(s, filterSection));

    if (!matchesSection) continue;

    totalHours += eff;
    if (filterSection) sectionHours += eff;
    subjects.add(r.subject_name.trim().toLowerCase());
    for (const s of secs) {
      if (s.trim()) sections.add(s);
    }
    if (!r.teacher_ids?.length) withoutTeacher += 1;
    if (!r.room_ids?.length) withoutRoom += 1;
    if (r.biweekly) biweeklyCount += 1;
  }

  const planHours =
    filterSection && opts?.catalogPlanHours != null && opts.catalogPlanHours > 0
      ? opts.catalogPlanHours
      : null;
  const planDelta = planHours != null ? sectionHours - planHours : null;

  const profiles = opts?.classProfiles ?? [];
  const capacitySource = opts?.capacityRows ?? rows;
  const hoursBySection = buildHoursBySection(capacitySource);
  const capacityWarnings =
    profiles.length > 0
      ? checkClassCapacityWarnings(hoursBySection, profiles, {
          focusSection: filterSection || undefined,
        })
      : [];
  const weeklyLimit =
    filterSection && profiles.length > 0 ? weeklyLimitForSection(profiles, filterSection) : null;

  return {
    count: rows.filter((r) => {
      if (!filterSection) return true;
      return (r.class_sections ?? []).some((s) => sectionsMatch(s, filterSection));
    }).length,
    totalHours: filterSection ? sectionHours : totalHours,
    subjectCount: subjects.size,
    sectionCount: sections.size,
    withoutTeacher,
    withoutRoom,
    biweeklyCount,
    sectionHours: filterSection ? sectionHours : null,
    planHours,
    planDelta,
    weeklyLimit,
    capacityWarnings,
  };
}

export type AssignedLessonsStatusTone = 'neutral' | 'ok' | 'warn' | 'error';

export function assignedLessonsStatusLabel(summary: AssignedLessonsSummary): {
  label: string;
  tone: AssignedLessonsStatusTone;
} {
  if (summary.count === 0) {
    return { label: 'Kayıt yok', tone: 'neutral' };
  }
  const capErr = summary.capacityWarnings.filter((w) => w.severity === 'error');
  if (capErr.length === 1) {
    const w = capErr[0]!;
    if (w.code === 'CLASS_OVER_MAX' || w.code === 'CLASS_OVER_CAPACITY') {
      return {
        label: `Haftalık sınır aşıldı (+${w.assignedHours - w.limitHours})`,
        tone: 'error',
      };
    }
    return { label: w.message, tone: 'error' };
  }
  if (capErr.length > 1) {
    return { label: `${capErr.length} profilde haftalık sınır aşıldı`, tone: 'error' };
  }
  const capWarn = summary.capacityWarnings.find((w) => w.code === 'CLASS_UNDER_MIN');
  if (capWarn) {
    return { label: capWarn.message, tone: 'warn' };
  }
  if (summary.planDelta != null) {
    if (summary.planDelta > 0) {
      return { label: `Katalogdan ${summary.planDelta} saat fazla`, tone: 'error' };
    }
    if (summary.planDelta < 0) {
      return { label: `${-summary.planDelta} saat eksik (katalog)`, tone: 'warn' };
    }
    return { label: 'Katalog ile uyumlu', tone: 'ok' };
  }
  if (summary.withoutTeacher > 0) {
    return {
      label: `${summary.withoutTeacher} atamada öğretmen yok`,
      tone: summary.withoutTeacher === summary.count ? 'error' : 'warn',
    };
  }
  if (summary.withoutRoom > 0) {
    return {
      label: `${summary.withoutRoom} atamada derslik yok`,
      tone: 'warn',
    };
  }
  return { label: 'Tamam', tone: 'ok' };
}
