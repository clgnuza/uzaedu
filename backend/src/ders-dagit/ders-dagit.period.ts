/** Faz 2 — Stüdyo dönem / zaman ayarları */

export type LongBreakDef = {
  /** Bu dersten sonra mola (örn. 4 → öğle arası) */
  after_lesson: number;
  label?: string;
  /** Kaç ders slotu bloklanır (genelde 1 = öğle) */
  blocked_slots?: number;
};

export type StudioPeriodConfig = {
  label?: string;
  work_days?: number[];
  /** Gün bazlı max ders: { "6": 4 } = Cumartesi 4 ders */
  lessons_per_day_by_dow?: Record<string, number>;
  long_breaks?: LongBreakDef[];
  /** Öğretim yılı notu */
  academic_note?: string;
};

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export function parseStudioPeriod(raw: unknown): StudioPeriodConfig {
  if (!raw || typeof raw !== 'object') {
    return { work_days: [...DEFAULT_WORK_DAYS], long_breaks: [], lessons_per_day_by_dow: {} };
  }
  const o = raw as StudioPeriodConfig;
  const work_days = Array.isArray(o.work_days)
    ? o.work_days.filter((d) => d >= 1 && d <= 7)
    : [...DEFAULT_WORK_DAYS];
  return {
    label: o.label,
    work_days,
    lessons_per_day_by_dow: o.lessons_per_day_by_dow ?? {},
    long_breaks: Array.isArray(o.long_breaks) ? o.long_breaks : [],
    academic_note: o.academic_note,
  };
}

/** Eski API uyumu; öğle artık ders sırası tüketmez (ayrı mola). */
export function blockedLessonNums(_period: StudioPeriodConfig): Set<number> {
  return new Set();
}

export function lunchAfterLesson(period: StudioPeriodConfig): number {
  return period.long_breaks?.[0]?.after_lesson ?? 4;
}

export function maxLessonsForDay(period: StudioPeriodConfig, day: number, schoolDefault: number): number {
  const key = String(day);
  const v = period.lessons_per_day_by_dow?.[key];
  if (v != null && v >= 1) return Math.min(schoolDefault, v);
  return schoolDefault;
}
