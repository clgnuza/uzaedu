export type TeacherAvailabilityPolicy = {
  /** Öğretmenler tercih girebilir (preference_window_open ile birlikte) */
  collection_enabled: boolean;
  /** true: onay sonrası teacher_config güncellenir; false: doğrudan kayıt */
  require_admin_approval: boolean;
  /** Pencere açılınca öğretmenlere bildirim */
  notify_teachers_on_open: boolean;
  /** Yönerge metni (öğretmen ekranı) */
  instruction_text: string | null;
  /** ISO tarih — son gönderim (bilgi amaçlı) */
  deadline: string | null;
  /** İdare başvurunun bir kısmını onaylayabilir */
  allow_partial_approval: boolean;
};

const DEFAULT_POLICY: TeacherAvailabilityPolicy = {
  collection_enabled: false,
  require_admin_approval: true,
  notify_teachers_on_open: true,
  instruction_text: null,
  deadline: null,
  allow_partial_approval: true,
};

export function parseTeacherAvailabilityPolicy(settings: Record<string, unknown> | null | undefined): TeacherAvailabilityPolicy {
  const raw = settings?.teacher_availability;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_POLICY };
  const o = raw as Record<string, unknown>;
  return {
    collection_enabled: o.collection_enabled === true,
    require_admin_approval: o.require_admin_approval !== false,
    notify_teachers_on_open: o.notify_teachers_on_open !== false,
    instruction_text: typeof o.instruction_text === 'string' ? o.instruction_text : null,
    deadline: typeof o.deadline === 'string' ? o.deadline : null,
    allow_partial_approval: o.allow_partial_approval !== false,
  };
}

const MAX_LESSONS_CAP = 12;

export function periodKeys(
  periods: Array<{ day_of_week: number; lesson_num?: number }>,
  maxLessons: number,
): Set<string> {
  const keys = new Set<string>();
  for (const p of periods) {
    if (p.lesson_num == null) {
      keys.add(`${p.day_of_week}:*`);
      for (let l = 1; l <= maxLessons; l++) keys.add(`${p.day_of_week}:${l}`);
    } else {
      keys.add(`${p.day_of_week}:${p.lesson_num}`);
    }
  }
  return keys;
}

/** Onaylanan her slot öğretmen talebinin kapsamında olmalı */
export function assertApprovedPeriodsSubset(
  requested: Array<{ day_of_week: number; lesson_num?: number }>,
  approved: Array<{ day_of_week: number; lesson_num?: number }>,
  maxLessons = MAX_LESSONS_CAP,
): void {
  const req = periodKeys(requested, maxLessons);
  const appr = periodKeys(approved, maxLessons);
  for (const k of appr) {
    if (!req.has(k)) {
      throw new Error(`Onaylanan slot talep dışı: ${k}`);
    }
  }
}

export function approvedPeriodsSubsetOfRequest(
  requested: Array<{ day_of_week: number; lesson_num?: number }>,
  approved: Array<{ day_of_week: number; lesson_num?: number }>,
  maxLessons = MAX_LESSONS_CAP,
): boolean {
  const req = periodKeys(requested, maxLessons);
  const appr = periodKeys(approved, maxLessons);
  for (const k of appr) {
    if (!req.has(k)) return false;
  }
  return true;
}

export function periodsKeySetEqual(
  a: Array<{ day_of_week: number; lesson_num?: number }>,
  b: Array<{ day_of_week: number; lesson_num?: number }>,
  maxLessons = MAX_LESSONS_CAP,
): boolean {
  const ka = periodKeys(a, maxLessons);
  const kb = periodKeys(b, maxLessons);
  if (ka.size !== kb.size) return false;
  for (const k of ka) if (!kb.has(k)) return false;
  return true;
}

export function mergeTeacherAvailabilityPolicy(
  settings: Record<string, unknown>,
  patch: Partial<TeacherAvailabilityPolicy>,
): Record<string, unknown> {
  const cur = parseTeacherAvailabilityPolicy(settings);
  return {
    ...settings,
    teacher_availability: {
      ...cur,
      ...patch,
    },
  };
}

export function normalizeAvailabilityPeriods(
  periods: unknown,
): Array<{ day_of_week: number; lesson_num?: number }> {
  if (!Array.isArray(periods)) return [];
  const out: Array<{ day_of_week: number; lesson_num?: number }> = [];
  for (const p of periods) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const day = Number(o.day_of_week);
    if (!Number.isFinite(day) || day < 1 || day > 7) continue;
    const lessonRaw = o.lesson_num;
    if (lessonRaw == null || lessonRaw === '') {
      out.push({ day_of_week: day });
      continue;
    }
    const lesson = Number(lessonRaw);
    if (Number.isFinite(lesson) && lesson >= 1) out.push({ day_of_week: day, lesson_num: lesson });
  }
  return out;
}
