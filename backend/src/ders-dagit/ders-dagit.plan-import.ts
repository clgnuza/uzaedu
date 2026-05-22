/** Okul ders programı planından ders kataloğu + atama türetme */

export function cleanPlanSubjectName(raw: string): string {
  let s = String(raw ?? '').trim();
  s = s.replace(/^[,;.\s:·]+/, '').replace(/[,;.\s:·]+$/, '');
  return s.replace(/\s+/g, ' ').trim();
}

export type PlanEntryLike = {
  class_section?: string | null;
  subject?: string | null;
  user_id?: string | null;
};

export type PlanImportRow = {
  subject: string;
  subject_raw: string;
  section: string;
  weekly_hours: number;
  teacher_ids: string[];
};

export function aggregatePlanImportRows(entries: PlanEntryLike[]): {
  rows: PlanImportRow[];
  skipped: number;
  names_fixed: number;
} {
  const bucket = new Map<
    string,
    { subject: string; subject_raw: string; section: string; hours: number; teacherIds: Set<string> }
  >();
  let skipped = 0;
  let names_fixed = 0;

  for (const e of entries) {
    const section = String(e.class_section ?? '').trim();
    const subject_raw = String(e.subject ?? '').trim();
    const subject = cleanPlanSubjectName(subject_raw);
    if (!section || !subject) {
      skipped++;
      continue;
    }
    if (subject !== subject_raw) names_fixed++;
    const k = `${subject}\0${section}`;
    let b = bucket.get(k);
    if (!b) {
      b = { subject, subject_raw, section, hours: 0, teacherIds: new Set() };
      bucket.set(k, b);
    }
    b.hours += 1;
    if (e.user_id) b.teacherIds.add(e.user_id);
  }

  const rows: PlanImportRow[] = [...bucket.values()].map((b) => ({
    subject: b.subject,
    subject_raw: b.subject_raw,
    section: b.section,
    weekly_hours: b.hours,
    teacher_ids: [...b.teacherIds],
  }));

  return { rows, skipped, names_fixed };
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
  return [...byName.entries()].map(([name, class_hours]) => ({ name, class_hours }));
}
