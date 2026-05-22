/** Faz 38 — Ek ders parametreleri → öğretmen saat limitleri (maaş karşılığı norm) */

import type { MebSchoolType } from './ders-dagit.school-profile';

export type TeacherHourNorm = {
  mandatory_weekly_hours: number;
  max_extra_weekly_hours: number;
  max_lessons_per_day: number;
  source: string;
};

const NORM_BY_TYPE: Record<MebSchoolType, { mandatory: number; extra: number }> = {
  ilkokul: { mandatory: 30, extra: 0 },
  ortaokul: { mandatory: 18, extra: 6 },
  anadolu_lise: { mandatory: 18, extra: 6 },
  mtal: { mandatory: 18, extra: 6 },
  fen_lise: { mandatory: 18, extra: 6 },
  aihl: { mandatory: 18, extra: 6 },
};

export function teacherHourNormFromSchool(
  schoolType: MebSchoolType,
  dutyMaxPerDay: number | null,
): TeacherHourNorm {
  const row = NORM_BY_TYPE[schoolType] ?? NORM_BY_TYPE.anadolu_lise;
  const perDay = dutyMaxPerDay != null && dutyMaxPerDay >= 1 ? dutyMaxPerDay : 7;
  return {
    mandatory_weekly_hours: row.mandatory,
    max_extra_weekly_hours: row.extra,
    max_lessons_per_day: perDay,
    source: `meb_${schoolType}`,
  };
}
