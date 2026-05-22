/** Faz 33 — MEB okul türü profili (stüdyo settings.school_profile) */

export type MebSchoolType =
  | 'ilkokul'
  | 'ortaokul'
  | 'anadolu_lise'
  | 'mtal'
  | 'fen_lise'
  | 'aihl';

export type YksTrack = 'sayisal' | 'sozel' | 'ea' | 'dil';

export type StudioSchoolProfile = {
  type: MebSchoolType;
  /** 12. sınıf YKS kolu (anadolu/fen) */
  yks_track?: YksTrack | null;
  /** Bu günlerde staj vb. — listedeki şubeler ders almaz (boş: tüm şubeler) */
  internship_days?: number[];
  internship_sections?: string[];
};

export const MEB_SCHOOL_TYPE_LABELS: Record<MebSchoolType, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  anadolu_lise: 'Anadolu Lisesi',
  mtal: 'Mesleki ve Teknik AL (MTAL)',
  fen_lise: 'Fen ve Sosyal Bilimler Lisesi',
  aihl: 'Anadolu İmam Hatip Lisesi',
};

const VALID_TYPES = new Set<string>(Object.keys(MEB_SCHOOL_TYPE_LABELS));

export function parseSchoolProfile(raw: unknown): StudioSchoolProfile {
  if (!raw || typeof raw !== 'object') {
    return { type: 'anadolu_lise', internship_days: [], internship_sections: [] };
  }
  const o = raw as StudioSchoolProfile;
  const type = VALID_TYPES.has(o.type) ? o.type : 'anadolu_lise';
  const internship_days = Array.isArray(o.internship_days)
    ? o.internship_days.filter((d) => d >= 1 && d <= 7)
    : [];
  const internship_sections = Array.isArray(o.internship_sections)
    ? o.internship_sections.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const yks =
    o.yks_track === 'sayisal' || o.yks_track === 'sozel' || o.yks_track === 'ea' || o.yks_track === 'dil'
      ? o.yks_track
      : null;
  return { type, yks_track: yks, internship_days, internship_sections };
}

export function isInternshipBlocked(
  profile: StudioSchoolProfile,
  day: number,
  classSection: string,
): boolean {
  if (!profile.internship_days?.includes(day)) return false;
  const secs = profile.internship_sections ?? [];
  if (!secs.length) return true;
  return secs.includes(classSection);
}

export function assignmentBlockLessons(options?: Record<string, unknown>): number {
  const n = Number(options?.block_lessons ?? 0);
  return n >= 2 && n <= 8 ? Math.floor(n) : 0;
}

export function assignmentPlaceOnDays(options?: Record<string, unknown>): number[] | null {
  const raw = options?.place_on_days;
  if (!Array.isArray(raw)) return null;
  const days = raw.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7);
  return days.length ? days : null;
}
