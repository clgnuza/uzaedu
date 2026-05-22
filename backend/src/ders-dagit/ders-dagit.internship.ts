/** Staj / işletmede beceri eğitimi — yerleştirme engeli (MEB: program ve şube bazlı farklı günler) */

import type { DersDagitClassProfile } from './entities';
import type { StudioSchoolProfile } from './ders-dagit.school-profile';
import type { SectionScheduleConfig } from './ders-dagit.section-schedule';

export type InternshipBlockContext = {
  school_profile: StudioSchoolProfile;
  section_schedules: Map<string, SectionScheduleConfig>;
  /** Şube → staj günleri (sınıf profillerinden birleştirilmiş) */
  section_internship_from_profiles: Map<string, number[]>;
};

export function normalizeInternshipDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
}

/** Sınıf profillerinden şube → gün haritası */
export function internshipDaysBySectionFromProfiles(profiles: DersDagitClassProfile[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const p of profiles) {
    const days = normalizeInternshipDays(p.internship_days);
    if (!days.length) continue;
    for (const sec of p.class_sections ?? []) {
      const prev = map.get(sec) ?? [];
      map.set(sec, [...new Set([...prev, ...days])].sort((a, b) => a - b));
    }
  }
  return map;
}

/**
 * Öncelik: 1) şube zaman tablosu internship_days 2) sınıf profili 3) eski okul geneli (geriye uyum)
 */
export function isInternshipPlacementBlocked(
  ctx: InternshipBlockContext,
  day: number,
  classSection: string,
): boolean {
  const sched = ctx.section_schedules.get(classSection);
  if (sched?.internship_days?.includes(day)) return true;

  const fromProfile = ctx.section_internship_from_profiles.get(classSection) ?? [];
  if (fromProfile.includes(day)) return true;

  const sp = ctx.school_profile;
  if (!sp.internship_days?.includes(day)) return false;
  const secs = sp.internship_sections ?? [];
  if (!secs.length) return true;
  return secs.includes(classSection);
}
