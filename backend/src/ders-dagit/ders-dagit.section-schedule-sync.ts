import { sectionsEquivalent } from './class-section-canonical';
import {
  internshipDaysBySectionFromProfiles,
  isInternshipPlacementBlocked,
  type InternshipBlockContext,
} from './ders-dagit.internship';
import { buildMaxLessonByDay } from './ders-dagit.validation-feasibility';
import { maxLessonsForDay, type StudioPeriodConfig } from './ders-dagit.period';
import {
  isSectionSlotPlaceable,
  parseSectionSchedules,
  sectionSchedulesToJson,
  type SectionScheduleConfig,
} from './ders-dagit.section-schedule';
import type { DersDagitClassProfile } from './entities';
import type { StudioSchoolProfile } from './ders-dagit.school-profile';

function effWeeklyHours(weekly: number, biweekly: boolean): number {
  return biweekly ? Math.ceil(weekly / 2) : weekly;
}

function hoursBySectionFromAssignments(
  assignments: Array<{ weekly_hours: number; biweekly: boolean; class_sections: string[] }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of assignments) {
    const hrs = effWeeklyHours(a.weekly_hours, a.biweekly);
    for (const sec of a.class_sections ?? []) {
      const s = sec.trim();
      if (!s) continue;
      out.set(s, (out.get(s) ?? 0) + hrs);
    }
  }
  return out;
}

function countPlaceableSlots(
  schedule: SectionScheduleConfig | undefined,
  section: string,
  workDays: number[],
  period: StudioPeriodConfig,
  schoolDefault: number,
  maxLessonByDay: Map<number, number>,
  internshipCtx: InternshipBlockContext,
): number {
  let open = 0;
  for (const day of workDays) {
    if (isInternshipPlacementBlocked(internshipCtx, day, section)) continue;
    const dayMax = maxLessonByDay.get(day) ?? schoolDefault;
    for (let lesson = 1; lesson <= dayMax; lesson++) {
      if (isSectionSlotPlaceable(schedule, day, lesson, period, schoolDefault)) open++;
    }
  }
  return open;
}

function findScheduleForSection(
  map: Map<string, SectionScheduleConfig>,
  section: string,
): SectionScheduleConfig {
  if (map.has(section)) return { ...map.get(section)! };
  for (const [k, v] of map) {
    if (sectionsEquivalent(k, section)) return { ...v };
  }
  return { lessons_per_day_by_dow: {}, cells: {} };
}

function setScheduleForSection(
  map: Map<string, SectionScheduleConfig>,
  section: string,
  sched: SectionScheduleConfig,
): void {
  for (const key of [...map.keys()]) {
    if (sectionsEquivalent(key, section)) map.delete(key);
  }
  map.set(section, sched);
}

function pruneOutOfRangeCells(
  sched: SectionScheduleConfig,
  workDays: number[],
  maxLessonByDay: Map<number, number>,
  schoolDefault: number,
): SectionScheduleConfig {
  const cells = { ...(sched.cells ?? {}) };
  let changed = false;
  for (const key of Object.keys(cells)) {
    const [d, l] = key.split(':').map(Number);
    const dayMax = maxLessonByDay.get(d!) ?? schoolDefault;
    if (!workDays.includes(d!) || l! < 1 || l! > dayMax) {
      delete cells[key];
      changed = true;
    }
  }
  if (!changed) return sched;
  const next: SectionScheduleConfig = { ...sched };
  if (Object.keys(cells).length) next.cells = cells;
  else delete next.cells;
  return next;
}

/** Atanan saat ≥ açık slot ise kapalı hücreleri otomatik aç (üstten başlayarak). */
export function syncSectionSchedulesOpenSlots(input: {
  section_schedules: Map<string, SectionScheduleConfig>;
  assignments: Array<{ weekly_hours: number; biweekly: boolean; class_sections: string[] }>;
  work_days: number[];
  max_lesson_per_day: number;
  period: StudioPeriodConfig;
  school_profile: StudioSchoolProfile;
  class_profiles: DersDagitClassProfile[];
}): {
  map: Map<string, SectionScheduleConfig>;
  opened_cells: number;
  pruned_cells: number;
  sections_adjusted: string[];
} {
  const map = new Map(input.section_schedules);
  const hoursBySection = hoursBySectionFromAssignments(input.assignments);
  const workDays = input.work_days.length ? input.work_days : [1, 2, 3, 4, 5];
  const maxLessonByDay = buildMaxLessonByDay(workDays, input.period, input.max_lesson_per_day);
  const internshipCtx: InternshipBlockContext = {
    school_profile: input.school_profile,
    section_schedules: map,
    section_internship_from_profiles: internshipDaysBySectionFromProfiles(input.class_profiles),
  };

  let opened_cells = 0;
  let pruned_cells = 0;
  const sections_adjusted: string[] = [];

  for (const [section, required] of hoursBySection) {
    if (required <= 0) continue;
    const beforePrune = findScheduleForSection(map, section);
    let sched = pruneOutOfRangeCells(beforePrune, workDays, maxLessonByDay, input.max_lesson_per_day);
    const pruned =
      JSON.stringify(beforePrune.cells ?? {}) !== JSON.stringify(sched.cells ?? {});
    if (pruned) {
      const nBefore = Object.keys(beforePrune.cells ?? {}).length;
      const nAfter = Object.keys(sched.cells ?? {}).length;
      pruned_cells += Math.max(0, nBefore - nAfter);
      setScheduleForSection(map, section, sched);
    }
    let open = countPlaceableSlots(
      sched,
      section,
      workDays,
      input.period,
      input.max_lesson_per_day,
      maxLessonByDay,
      internshipCtx,
    );
    if (open >= required) continue;

    const cells = { ...(sched.cells ?? {}) };
    const closedKeys = Object.entries(cells)
      .filter(([, v]) => v === 'closed')
      .map(([k]) => k)
      .sort((a, b) => {
        const [da, la] = a.split(':').map(Number);
        const [db, lb] = b.split(':').map(Number);
        return da! - db! || la! - lb!;
      });

    let sectionOpened = 0;
    while (open < required && closedKeys.length) {
      const key = closedKeys.pop()!;
      delete cells[key];
      sectionOpened++;
      sched = { ...sched, cells: Object.keys(cells).length ? cells : undefined };
      if (!sched.cells) delete sched.cells;
      open = countPlaceableSlots(
        sched,
        section,
        workDays,
        input.period,
        input.max_lesson_per_day,
        maxLessonByDay,
        { ...internshipCtx, section_schedules: map },
      );
    }

    if (sectionOpened > 0) {
      setScheduleForSection(map, section, sched);
      opened_cells += sectionOpened;
      sections_adjusted.push(section);
    }
  }

  return { map, opened_cells, pruned_cells, sections_adjusted };
}

export function parseAndSyncSectionSchedulesJson(
  raw: unknown,
  input: Omit<Parameters<typeof syncSectionSchedulesOpenSlots>[0], 'section_schedules'>,
): {
  json: Record<string, SectionScheduleConfig>;
  opened_cells: number;
  pruned_cells: number;
  sections_adjusted: string[];
} {
  const map = parseSectionSchedules(raw);
  const r = syncSectionSchedulesOpenSlots({ ...input, section_schedules: map });
  return {
    json: sectionSchedulesToJson(r.map),
    opened_cells: r.opened_cells,
    pruned_cells: r.pruned_cells,
    sections_adjusted: r.sections_adjusted,
  };
}
