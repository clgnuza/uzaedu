/** Faz 36 — İkili eğitim (sabah / öğle vardiyası) */

import { blockedLessonNums, lunchAfterLesson, type StudioPeriodConfig } from './ders-dagit.period';

export type EducationShift = 'morning' | 'afternoon';

export type DualEducationConfig = {
  enabled: boolean;
  /** Öğle vardiyası ilk ders sırası (boş = öğle arasından sonra) */
  pm_first_lesson?: number;
};

export function parseDualEducation(raw: unknown): DualEducationConfig {
  if (!raw || typeof raw !== 'object') return { enabled: false };
  const o = raw as DualEducationConfig;
  return {
    enabled: !!o.enabled,
    pm_first_lesson:
      o.pm_first_lesson != null && o.pm_first_lesson >= 1 ? Math.floor(o.pm_first_lesson) : undefined,
  };
}

export function pmFirstLessonNum(period: StudioPeriodConfig, dual: DualEducationConfig): number {
  if (dual.pm_first_lesson != null) return dual.pm_first_lesson;
  const lunch = lunchAfterLesson(period);
  const blocked = blockedLessonNums(period);
  let n = lunch + 1;
  while (blocked.has(n)) n++;
  return n;
}

export function lessonInShift(
  lesson: number,
  shift: EducationShift | null | undefined,
  pmFirst: number,
): boolean {
  if (!shift) return true;
  if (shift === 'morning') return lesson < pmFirst;
  return lesson >= pmFirst;
}

export function normalizeEducationShift(raw: unknown): EducationShift | null {
  if (raw === 'morning' || raw === 'afternoon') return raw;
  return null;
}
