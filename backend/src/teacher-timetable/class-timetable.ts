import {
  extractEokulLessonPairs,
  formatClassSection,
  foldTurkish,
  normalizeClassToken,
  normalizeWhitespace,
  splitEokulCell,
} from './timetable-reconcile/normalize';

export type TeacherRowForClassSync = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  user_id: string | null;
  teacher_name_raw?: string | null;
};

export type ClassTimetableRow = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  user_id: string | null;
  teacher_name: string | null;
};

/** Kayıt ve sorgu için tek biçim: 10-A */
export function normalizeClassSectionForStorage(raw: string): string {
  const token = normalizeClassToken(raw);
  if (token) return token;
  const trimmed = normalizeWhitespace(raw).slice(0, 32);
  if (!trimmed) return '';
  const loose = formatClassSection(trimmed);
  return loose || trimmed;
}

/** Sınıf boşsa subject / e-Okul metninden çıkar */
export function coalesceEntryClassSubject(
  classSection: string,
  subject: string,
): { class_section: string; subject: string } {
  let cls = normalizeClassSectionForStorage(classSection);
  let sub = normalizeWhitespace(subject).slice(0, 128);
  if (cls) return { class_section: cls, subject: sub };

  if (sub) {
    const pairs = extractEokulLessonPairs(sub);
    if (pairs.length === 1) {
      return { class_section: pairs[0]!.class_section, subject: pairs[0]!.subject };
    }
    const split = splitEokulCell(sub);
    if (split.length === 1) {
      return { class_section: split[0]!.class_section, subject: split[0]!.subject };
    }
    const lead = /^(\d{1,2})\s*([A-ZÇĞİÖŞÜ])\s*[-–:]\s*(.+)$/iu.exec(sub);
    if (lead) {
      const c = formatClassSection(`${lead[1]}${lead[2]!.toLocaleUpperCase('tr-TR')}`);
      if (c) return { class_section: c, subject: normalizeWhitespace(lead[3]).slice(0, 128) };
    }
    const compact = /^(\d{1,2})([A-ZÇĞİÖŞÜ])\s+(.+)$/iu.exec(sub);
    if (compact) {
      const c = formatClassSection(`${compact[1]}${compact[2]!.toLocaleUpperCase('tr-TR')}`);
      if (c) return { class_section: c, subject: normalizeWhitespace(compact[3]).slice(0, 128) };
    }
  }

  const rawCls = normalizeWhitespace(classSection).slice(0, 32);
  return { class_section: rawCls, subject: sub };
}

function normSubject(s: string): string {
  return foldTurkish(normalizeWhitespace(s)).toUpperCase();
}

/**
 * Öğretmen satırlarından sınıf programı: (gün, saat, sınıf, ders) anahtarı.
 * Aynı slotta farklı ders → ayrı satır; aynı ders farklı öğretmen → user_id olan tercih.
 */
export function deriveClassScheduleFromTeacherRows(
  rows: TeacherRowForClassSync[],
): { entries: ClassTimetableRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const byKey = new Map<string, ClassTimetableRow>();

  for (const r of rows) {
    const day = r.day_of_week;
    const lesson = r.lesson_num;
    const cls = normalizeClassSectionForStorage(r.class_section);
    const subject = normalizeWhitespace(r.subject).slice(0, 128);
    if (day < 1 || day > 5 || lesson < 1 || lesson > 12) continue;
    if (!cls) {
      warnings.push(`Sınıf ayrıştırılamadı: "${(r.class_section || '').slice(0, 40)}"`);
      continue;
    }
    if (!subject) continue;

    const key = `${day}|${lesson}|${cls}|${normSubject(subject)}`;
    const teacherName = r.teacher_name_raw?.trim() || null;
    const candidate: ClassTimetableRow = {
      day_of_week: day,
      lesson_num: lesson,
      class_section: cls,
      subject,
      user_id: r.user_id,
      teacher_name: teacherName,
    };

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    if (!existing.user_id && candidate.user_id) {
      byKey.set(key, candidate);
      continue;
    }
    if (existing.user_id && !candidate.user_id) continue;
    if (existing.teacher_name !== candidate.teacher_name && candidate.teacher_name) {
      warnings.push(
        `${cls} ${day}. gün ${lesson}. saat (${subject.slice(0, 30)}): birden fazla öğretmen kaydı`,
      );
    }
  }

  const entries = [...byKey.values()].sort((a, b) => {
    if (a.class_section !== b.class_section) return a.class_section.localeCompare(b.class_section, 'tr');
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.lesson_num - b.lesson_num;
  });

  return { entries, warnings };
}

/** Sorgu eşlemesi: "10-A", "10-a", "10. Sınıf / A" */
export function classSectionMatches(stored: string, query: string): boolean {
  const a = normalizeClassSectionForStorage(stored);
  const b = normalizeClassSectionForStorage(query);
  if (a && b) return a.toLowerCase() === b.toLowerCase();
  return foldTurkish(stored).toUpperCase() === foldTurkish(query).toUpperCase();
}
