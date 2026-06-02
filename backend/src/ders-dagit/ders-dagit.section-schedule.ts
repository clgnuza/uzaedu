/** Şube bazlı ders slot durumu (MTAL / farklı günlük ders sayısı) */

import { sectionsEquivalent } from './class-section-canonical';
import { sortClassSections } from './class-section-sort';
import { maxLessonsForDay, type StudioPeriodConfig } from './ders-dagit.period';

export type SectionSlotState = 'available' | 'closed' | 'internship' | 'lunch';

export type SectionScheduleConfig = {
  /** Gün → max ders sırası (boşsa stüdyo/okul varsayılanı) */
  lessons_per_day_by_dow?: Record<string, number>;
  /** Tüm gün staj/beceri (şube özel; sınıf profilinden farklı olabilir) */
  internship_days?: number[];
  /** Yalnız available dışı hücreler: "gün:ders" → durum */
  cells?: Record<string, SectionSlotState>;
};

export type SectionSlotEffective = SectionSlotState | 'no_slot';

const CELL_KEY = (day: number, lesson: number) => `${day}:${lesson}`;

export function parseSectionSchedules(raw: unknown): Map<string, SectionScheduleConfig> {
  const map = new Map<string, SectionScheduleConfig>();
  if (!raw || typeof raw !== 'object') return map;
  for (const [sec, val] of Object.entries(raw as Record<string, unknown>)) {
    const name = sec.trim();
    if (!name || !val || typeof val !== 'object') continue;
    const o = val as SectionScheduleConfig;
    const lessons_per_day_by_dow: Record<string, number> = {};
    if (o.lessons_per_day_by_dow && typeof o.lessons_per_day_by_dow === 'object') {
      for (const [k, v] of Object.entries(o.lessons_per_day_by_dow)) {
        const n = Number(v);
        if (n >= 1 && n <= 14) lessons_per_day_by_dow[k] = Math.floor(n);
      }
    }
    const cells: Record<string, SectionSlotState> = {};
    if (o.cells && typeof o.cells === 'object') {
      for (const [k, st] of Object.entries(o.cells)) {
        if (st === 'closed' || st === 'internship' || st === 'lunch') cells[k] = st;
      }
    }
    const internship_days = Array.isArray(o.internship_days)
      ? [...new Set(o.internship_days.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b)
      : undefined;
    map.set(name, {
      lessons_per_day_by_dow,
      cells,
      ...(internship_days?.length ? { internship_days } : {}),
    });
  }
  return map;
}

export function sectionSchedulesToJson(map: Map<string, SectionScheduleConfig>): Record<string, SectionScheduleConfig> {
  const out: Record<string, SectionScheduleConfig> = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}

export function parseExcludedClassSections(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  const out = new Set<string>();
  for (const item of raw) {
    const s = String(item ?? '').trim();
    if (s) out.add(s);
  }
  return out;
}

export function excludedClassSectionsToJson(excluded: Set<string>): string[] {
  return sortClassSections([...excluded]);
}

export function isClassSectionExcluded(section: string, excluded: Set<string>): boolean {
  const t = section.trim();
  if (!t) return false;
  for (const ex of excluded) {
    if (sectionsEquivalent(t, ex)) return true;
  }
  return false;
}

export function maxLessonsForSectionDay(
  schedule: SectionScheduleConfig | undefined,
  day: number,
  period: StudioPeriodConfig,
  schoolDefault: number,
): number {
  const key = String(day);
  const fromSec = schedule?.lessons_per_day_by_dow?.[key];
  if (fromSec != null && fromSec >= 1) return Math.min(schoolDefault, fromSec);
  return maxLessonsForDay(period, day, schoolDefault);
}

export function effectiveSectionSlotState(
  schedule: SectionScheduleConfig | undefined,
  day: number,
  lesson: number,
  period: StudioPeriodConfig,
  schoolDefault: number,
): SectionSlotEffective {
  const dayMax = maxLessonsForSectionDay(schedule, day, period, schoolDefault);
  if (lesson < 1 || lesson > dayMax) return 'no_slot';
  if (schedule?.internship_days?.includes(day)) return 'internship';
  const override = schedule?.cells?.[CELL_KEY(day, lesson)];
  if (override) return override;
  return 'available';
}

export function isSectionSlotPlaceable(
  schedule: SectionScheduleConfig | undefined,
  day: number,
  lesson: number,
  period: StudioPeriodConfig,
  schoolDefault: number,
): boolean {
  return effectiveSectionSlotState(schedule, day, lesson, period, schoolDefault) === 'available';
}
