import { buildTimetableRows, type GridRow, type LongBreakDef } from '@/lib/timetable-grid-build';

/** Şube slot ızgarası — backend ile uyumlu */

export type SectionSlotState = 'available' | 'closed' | 'internship' | 'lunch';

export type SectionSlotEffective = SectionSlotState | 'no_slot';

export type SectionScheduleConfig = {
  lessons_per_day_by_dow?: Record<string, number>;
  /** Tüm gün staj/beceri (şube özel) */
  internship_days?: number[];
  cells?: Record<string, SectionSlotState>;
};

export const SLOT_STATE_UI: Record<
  SectionSlotEffective,
  { label: string; short: string; className: string; aria: string }
> = {
  available: {
    label: 'Müsait',
    short: 'M',
    className: 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100',
    aria: 'müsait',
  },
  closed: {
    label: 'Kapalı',
    short: 'K',
    className:
      'bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:text-white dark:hover:bg-red-600',
    aria: 'kapalı',
  },
  internship: {
    label: 'Staj',
    short: 'S',
    className: 'bg-amber-200 text-amber-950 hover:bg-amber-300 dark:bg-amber-900/70 dark:text-amber-50',
    aria: 'staj',
  },
  lunch: {
    label: 'Öğle arası',
    short: 'Ö',
    className: 'bg-violet-200 text-violet-950 hover:bg-violet-300 dark:bg-violet-900/60 dark:text-violet-50',
    aria: 'öğle arası',
  },
  no_slot: {
    label: 'Ders yok',
    short: '—',
    className: 'bg-muted/40 text-muted-foreground cursor-not-allowed',
    aria: 'ders yok',
  },
};

export const PAINT_STATES: SectionSlotState[] = ['available', 'closed', 'internship', 'lunch'];

export function cellKey(day: number, lesson: number): string {
  return `${day}:${lesson}`;
}

export function effectiveSlotState(
  schedule: SectionScheduleConfig,
  day: number,
  lesson: number,
  dayMax: number,
): SectionSlotEffective {
  if (lesson < 1 || lesson > dayMax) return 'no_slot';
  if (schedule.internship_days?.includes(day)) return 'internship';
  const o = schedule.cells?.[cellKey(day, lesson)];
  if (o === 'lunch') return 'lunch';
  if (o) return o;
  return 'available';
}

export function setCellState(
  schedule: SectionScheduleConfig,
  day: number,
  lesson: number,
  state: SectionSlotState,
): SectionScheduleConfig {
  const cells = { ...(schedule.cells ?? {}) };
  const key = cellKey(day, lesson);
  if (state === 'available') delete cells[key];
  else cells[key] = state;
  return { ...schedule, cells };
}

export function setDayMaxLessons(schedule: SectionScheduleConfig, day: number, max: number): SectionScheduleConfig {
  const lessons_per_day_by_dow = { ...(schedule.lessons_per_day_by_dow ?? {}) };
  lessons_per_day_by_dow[String(day)] = max;
  return { ...schedule, lessons_per_day_by_dow };
}

export function setInternshipDays(schedule: SectionScheduleConfig, days: number[]): SectionScheduleConfig {
  const internship_days = [...new Set(days.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
  return { ...schedule, internship_days };
}

export function emptySchedule(): SectionScheduleConfig {
  return { lessons_per_day_by_dow: {}, internship_days: [], cells: {} };
}

export type { LongBreakDef, GridRow as SectionGridColumn };

export function buildSectionScheduleColumns(maxLesson: number, longBreaks?: LongBreakDef[]): GridRow[] {
  return buildTimetableRows(maxLesson, longBreaks ?? []);
}

export type SectionSlotCounts = {
  lessonCells: number;
  lunchCells: number;
  total: number;
  placeable: number;
  closed: number;
  internship: number;
};

export function countSectionSlots(
  schedule: SectionScheduleConfig,
  workDays: number[],
  schoolDefault: number,
  studioByDow?: Record<string, number>,
  longBreaks?: LongBreakDef[],
): SectionSlotCounts {
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  let lessonCells = 0;
  let lunchCells = 0;
  let placeable = 0;
  let closed = 0;
  let internship = 0;
  for (const d of days) {
    const max = dayMaxLessons(schedule, d, schoolDefault, studioByDow);
    const cols = buildSectionScheduleColumns(max, longBreaks);
    for (const col of cols) {
      if (col.kind === 'lunch') {
        lunchCells++;
        continue;
      }
      const lesson = col.lessonNum;
      lessonCells++;
      const eff = effectiveSlotState(schedule, d, lesson, max);
      if (eff === 'available') placeable++;
      else if (eff === 'closed') closed++;
      else if (eff === 'internship') internship++;
    }
  }
  return { lessonCells, lunchCells, total: lessonCells + lunchCells, placeable, closed, internship };
}

export function dayMaxLessons(
  schedule: SectionScheduleConfig,
  day: number,
  schoolDefault: number,
  studioByDow?: Record<string, number>,
): number {
  const fromSec = schedule.lessons_per_day_by_dow?.[String(day)];
  if (fromSec != null && fromSec >= 1) return Math.min(schoolDefault, fromSec);
  const fromStudio = studioByDow?.[String(day)];
  if (fromStudio != null && fromStudio >= 1) return Math.min(schoolDefault, fromStudio);
  return schoolDefault;
}
