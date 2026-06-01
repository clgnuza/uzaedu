/** Okul ders programı planından ders kataloğu + atama türetme */

import { sectionIdentityKey, isVerboseSectionName, mergeClassHoursBySectionAlias } from './class-section-canonical';
import { coalesceEntryClassSubject } from '../teacher-timetable/class-timetable';
import { foldTurkish } from '../teacher-timetable/timetable-reconcile/normalize';

export function cleanPlanSubjectName(raw: string): string {
  let s = String(raw ?? '').trim();
  s = s.replace(/^[,;.\s:·]+/, '').replace(/[,;.\s:·]+$/, '');
  return s.replace(/\s+/g, ' ').trim();
}

function normSubjectKey(subject: string): string {
  return foldTurkish(cleanPlanSubjectName(subject)).toUpperCase();
}

function pickSectionLabel(labels: string[]): string {
  if (!labels.length) return '';
  const verbose = labels.filter(isVerboseSectionName);
  const pool = verbose.length ? verbose : labels;
  return [...pool].sort((a, b) => b.length - a.length || a.localeCompare(b, 'tr'))[0]!;
}

export type PlanEntryLike = {
  class_section?: string | null;
  subject?: string | null;
  user_id?: string | null;
  day_of_week?: number | null;
  lesson_num?: number | null;
};

export type PlanImportRow = {
  subject: string;
  subject_raw: string;
  section: string;
  weekly_hours: number;
  teacher_ids: string[];
};

type Bucket = {
  subject: string;
  subject_raw: string;
  sectionLabels: string[];
  slots: Set<string>;
  teacherIds: Set<string>;
  legacyCount: number;
};

export function aggregatePlanImportRows(entries: PlanEntryLike[]): {
  rows: PlanImportRow[];
  skipped: number;
  names_fixed: number;
} {
  const bucket = new Map<string, Bucket>();
  let skipped = 0;
  let names_fixed = 0;

  for (const e of entries) {
    const subject_raw = String(e.subject ?? '').trim();
    const coalesced = coalesceEntryClassSubject(String(e.class_section ?? ''), subject_raw);
    const section = coalesced.class_section;
    const subject = cleanPlanSubjectName(coalesced.subject);
    if (!section || !subject) {
      skipped++;
      continue;
    }
    if (subject !== subject_raw) names_fixed++;

    const k = `${normSubjectKey(subject)}\0${sectionIdentityKey(section)}`;
    let b = bucket.get(k);
    if (!b) {
      b = {
        subject,
        subject_raw,
        sectionLabels: [],
        slots: new Set(),
        teacherIds: new Set(),
        legacyCount: 0,
      };
      bucket.set(k, b);
    }
    if (!b.sectionLabels.includes(section)) b.sectionLabels.push(section);
    if (subject_raw && !b.subject_raw) b.subject_raw = subject_raw;

    const day = Number(e.day_of_week);
    const lesson = Number(e.lesson_num);
    if (Number.isFinite(day) && Number.isFinite(lesson) && day >= 1 && day <= 7 && lesson >= 1 && lesson <= 12) {
      b.slots.add(`${day}|${lesson}`);
    } else {
      b.legacyCount += 1;
    }
    if (e.user_id) b.teacherIds.add(e.user_id);
  }

  const rows: PlanImportRow[] = [...bucket.values()].map((b) => ({
    subject: b.subject,
    subject_raw: b.subject_raw,
    section: pickSectionLabel(b.sectionLabels),
    weekly_hours: b.slots.size > 0 ? b.slots.size : b.legacyCount,
    teacher_ids: [...b.teacherIds],
  }));

  return { rows, skipped, names_fixed };
}

/** Aynı ders+şube satırlarını birleştirir (kanonik şube adı sonrası). */
export function mergePlanImportRows(rows: PlanImportRow[]): PlanImportRow[] {
  const m = new Map<string, PlanImportRow>();
  for (const r of rows) {
    const k = `${normSubjectKey(r.subject)}\0${sectionIdentityKey(r.section)}`;
    const prev = m.get(k);
    if (!prev) {
      m.set(k, { ...r, teacher_ids: [...r.teacher_ids] });
      continue;
    }
    prev.weekly_hours += r.weekly_hours;
    prev.teacher_ids = [...new Set([...prev.teacher_ids, ...r.teacher_ids])];
    if (isVerboseSectionName(r.section) && !isVerboseSectionName(prev.section)) {
      prev.section = r.section;
    }
  }
  return [...m.values()];
}

export function subjectsFromPlanRows(rows: PlanImportRow[]): Array<{
  name: string;
  class_hours: Record<string, number>;
}> {
  const byName = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const hrs = byName.get(r.subject) ?? {};
    hrs[r.section] = (hrs[r.section] ?? 0) + r.weekly_hours;
    byName.set(r.subject, hrs);
  }
  return [...byName.entries()].map(([name, class_hours]) => ({
    name,
    class_hours: mergeClassHoursBySectionAlias(class_hours),
  }));
}
