/** MEB programlarına uygun sınıf profili şablonları ve saat normları */

import type { MebSchoolType } from './ders-dagit.school-profile';
import { gradeFromClassSection } from './ders-dagit.ttkb-seed';

export type ClassProfilePresetId =
  | 'genel'
  | 'ilk_1_3'
  | 'ilk_4'
  | 'orta_5_6'
  | 'orta_7_8'
  | 'lise_9_10'
  | 'lise_11_12'
  | 'lise_12_yks'
  | 'mtal_sabah'
  | 'mtal_ogle'
  | 'mtal_alan';

export type ClassProfilePresetDef = {
  id: ClassProfilePresetId;
  label: string;
  hint: string;
  max_lessons_per_day: number;
  max_weekly_lessons: number;
  min_weekly_lessons: number;
  education_shift?: 'morning' | 'afternoon' | null;
  matchSection: (section: string) => boolean;
};

const GRADE_WEEKLY: Record<number, number> = {
  1: 30,
  2: 30,
  3: 30,
  4: 35,
  5: 35,
  6: 35,
  7: 35,
  8: 35,
  9: 37,
  10: 37,
  11: 35,
  12: 35,
};

export function weeklyHoursForGrade(grade: number, schoolType: MebSchoolType): number {
  const base = GRADE_WEEKLY[grade] ?? 35;
  if (schoolType === 'mtal' && grade >= 9) return Math.max(base, 42);
  return base;
}

/** Okul zaman çizelgesindeki günlük ders sayısı varsa o geçerli; yoksa türe göre MEB varsayılanı. */
export function defaultMaxLessonsPerDay(schoolType: MebSchoolType, dutyMax: number | null): number {
  if (dutyMax != null && dutyMax >= 1) return dutyMax;
  const byType: Record<MebSchoolType, number> = {
    ilkokul: 6,
    ortaokul: 7,
    anadolu_lise: 8,
    fen_lise: 8,
    aihl: 8,
    mtal: 8,
  };
  return byType[schoolType] ?? 8;
}

export function expectedWeeklyHoursForSections(sections: string[], schoolType: MebSchoolType): number {
  let max = 0;
  for (const s of sections) {
    const g = gradeFromClassSection(s);
    if (!g) continue;
    max = Math.max(max, weeklyHoursForGrade(g, schoolType));
  }
  if (max > 0) return max;
  if (schoolType === 'ilkokul') return 30;
  if (schoolType === 'ortaokul') return 35;
  if (schoolType === 'mtal') return 42;
  return 37;
}

function gradeIn(section: string, grades: number[]): boolean {
  const g = gradeFromClassSection(section);
  return g != null && grades.includes(g);
}

function fieldMatch(section: string, pattern: RegExp): boolean {
  return pattern.test(section.toLocaleUpperCase('tr'));
}

export function classProfilePresetsForSchool(
  schoolType: MebSchoolType,
  dutyMax: number | null,
): ClassProfilePresetDef[] {
  const maxDay = defaultMaxLessonsPerDay(schoolType, dutyMax);

  if (schoolType === 'ilkokul') {
    return [
      {
        id: 'genel',
        label: 'Tüm ilkokul (1–4)',
        hint: 'Günde en fazla 6–7 ders; haftalık ~30–35 saat.',
        max_lessons_per_day: Math.min(maxDay, 6),
        max_weekly_lessons: 35,
        min_weekly_lessons: 28,
        matchSection: () => true,
      },
      {
        id: 'ilk_1_3',
        label: '1–3. sınıflar',
        hint: 'Haftalık ~30 ders saati (TTKB).',
        max_lessons_per_day: Math.min(maxDay, 6),
        max_weekly_lessons: 30,
        min_weekly_lessons: 26,
        matchSection: (s) => gradeIn(s, [1, 2, 3]),
      },
      {
        id: 'ilk_4',
        label: '4. sınıf',
        hint: 'Haftalık ~35 ders saati (TTKB).',
        max_lessons_per_day: Math.min(maxDay, 7),
        max_weekly_lessons: 35,
        min_weekly_lessons: 30,
        matchSection: (s) => gradeIn(s, [4]),
      },
    ];
  }

  if (schoolType === 'ortaokul') {
    return [
      {
        id: 'genel',
        label: 'Tüm ortaokul (5–8)',
        hint: 'Günde en fazla 7 ders; haftalık ~35 saat.',
        max_lessons_per_day: Math.min(maxDay, 7),
        max_weekly_lessons: 35,
        min_weekly_lessons: 30,
        matchSection: () => true,
      },
      {
        id: 'orta_5_6',
        label: '5–6. sınıflar',
        hint: 'Haftalık ~35 saat.',
        max_lessons_per_day: Math.min(maxDay, 7),
        max_weekly_lessons: 35,
        min_weekly_lessons: 30,
        matchSection: (s) => gradeIn(s, [5, 6]),
      },
      {
        id: 'orta_7_8',
        label: '7–8. sınıflar',
        hint: 'Haftalık ~35 saat.',
        max_lessons_per_day: Math.min(maxDay, 7),
        max_weekly_lessons: 35,
        min_weekly_lessons: 30,
        matchSection: (s) => gradeIn(s, [7, 8]),
      },
    ];
  }

  if (schoolType === 'mtal') {
    return [
      {
        id: 'genel',
        label: 'Tüm şubeler',
        hint: 'Mesleki program; günde 8, haftalık ~40–42 saat.',
        max_lessons_per_day: maxDay,
        max_weekly_lessons: 42,
        min_weekly_lessons: 36,
        matchSection: () => true,
      },
      {
        id: 'mtal_sabah',
        label: 'Sabah öğretimi (ikili)',
        hint: 'İkili eğitim sabah vardiyası.',
        max_lessons_per_day: Math.min(maxDay, 5),
        max_weekly_lessons: 42,
        min_weekly_lessons: 36,
        education_shift: 'morning',
        matchSection: () => true,
      },
      {
        id: 'mtal_ogle',
        label: 'Öğle öğretimi (ikili)',
        hint: 'İkili eğitim öğle vardiyası.',
        max_lessons_per_day: Math.min(maxDay, 5),
        max_weekly_lessons: 42,
        min_weekly_lessons: 36,
        education_shift: 'afternoon',
        matchSection: () => true,
      },
      {
        id: 'lise_9_10',
        label: '9–10. sınıflar',
        hint: 'Haftalık ~37–42 saat.',
        max_lessons_per_day: maxDay,
        max_weekly_lessons: 42,
        min_weekly_lessons: 36,
        matchSection: (s) => gradeIn(s, [9, 10]),
      },
      {
        id: 'lise_11_12',
        label: '11–12. sınıflar',
        hint: 'Haftalık ~35–42 saat.',
        max_lessons_per_day: maxDay,
        max_weekly_lessons: 42,
        min_weekly_lessons: 34,
        matchSection: (s) => gradeIn(s, [11, 12]),
      },
      {
        id: 'mtal_alan',
        label: 'Alan şubeleri (AMP / meslek)',
        hint: 'Parantez içinde alan adı geçen şubeler.',
        max_lessons_per_day: maxDay,
        max_weekly_lessons: 42,
        min_weekly_lessons: 36,
        matchSection: (s) => fieldMatch(s, /\([^)]*(ALAN|HİZMET|BÖLÜM|AMP)/u),
      },
    ];
  }

  const liseBase: ClassProfilePresetDef[] = [
    {
      id: 'genel',
      label: 'Tüm lise (9–12)',
      hint: `Günde en fazla ${maxDay} ders; haftalık ~35–37 saat.`,
      max_lessons_per_day: maxDay,
      max_weekly_lessons: 37,
      min_weekly_lessons: 32,
      matchSection: () => true,
    },
    {
      id: 'lise_9_10',
      label: '9–10. sınıflar',
      hint: 'Haftalık ~37 saat (TTKB ortaöğretim).',
      max_lessons_per_day: maxDay,
      max_weekly_lessons: 37,
      min_weekly_lessons: 32,
      matchSection: (s) => gradeIn(s, [9, 10]),
    },
    {
      id: 'lise_11_12',
      label: '11–12. sınıflar',
      hint: 'Haftalık ~35 saat.',
      max_lessons_per_day: maxDay,
      max_weekly_lessons: 35,
      min_weekly_lessons: 30,
      matchSection: (s) => gradeIn(s, [11, 12]),
    },
    {
      id: 'lise_12_yks',
      label: '12. sınıf (YKS)',
      hint: 'Yalnızca 12. sınıf şubeleri.',
      max_lessons_per_day: maxDay,
      max_weekly_lessons: 35,
      min_weekly_lessons: 30,
      matchSection: (s) => gradeIn(s, [12]),
    },
  ];

  return liseBase;
}

export function presetById(
  schoolType: MebSchoolType,
  dutyMax: number | null,
  id: ClassProfilePresetId,
): ClassProfilePresetDef | undefined {
  return classProfilePresetsForSchool(schoolType, dutyMax).find((p) => p.id === id);
}

export function sectionsForPreset(
  allSections: string[],
  preset: ClassProfilePresetDef,
): string[] {
  return allSections.filter((s) => preset.matchSection(s));
}

export function suggestProfileName(preset: ClassProfilePresetDef): string {
  return preset.label;
}
