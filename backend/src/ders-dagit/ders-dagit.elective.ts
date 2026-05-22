/** Faz 37 — Seçmeli havuz + AİHL norm */

import { sortClassSections } from './class-section-sort';
import type { StudioSchoolProfile } from './ders-dagit.school-profile';

const ELECTIVE_RE = /seçmeli|elective|alan\s*ders/i;

export function isElectiveSubjectName(name: string): boolean {
  return ELECTIVE_RE.test(normalizeWhitespace(name));
}

export function normalizeWhitespace(s: string): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 5A-A → { base: 5A, track: A }; 5A → { base: 5A, track: null } */
export function splitSectionTrack(section: string): { base: string; track: string | null } {
  const s = normalizeWhitespace(section);
  const m = /^(.+?)[\s\-–]([A-Za-zÇĞİÖŞÜçğıöşü0-9]+)$/.exec(s);
  if (m && m[1]!.length >= 2) {
    return { base: m[1]!.trim(), track: m[2]!.trim() };
  }
  return { base: s, track: null };
}

export type ElectiveImportCluster = {
  base_section: string;
  member_sections: string[];
  subject_names: string[];
};

export function clusterElectiveImportRows(
  rows: Array<{
    subject_name: string;
    class_sections: string[];
    resolved_teacher_id?: string | null;
  }>,
): ElectiveImportCluster[] {
  const byBase = new Map<
    string,
    { sections: Set<string>; subjects: Set<string>; rowCount: number; teacherKeys: Set<string> }
  >();
  for (const r of rows) {
    if (!isElectiveSubjectName(r.subject_name)) continue;
    for (const sec of r.class_sections) {
      const { base, track } = splitSectionTrack(sec);
      if (!base) continue;
      const bucket = byBase.get(base) ?? {
        sections: new Set<string>(),
        subjects: new Set<string>(),
        rowCount: 0,
        teacherKeys: new Set<string>(),
      };
      bucket.sections.add(track ? `${base}-${track}` : sec);
      bucket.subjects.add(normalizeWhitespace(r.subject_name));
      bucket.rowCount++;
      bucket.teacherKeys.add(r.resolved_teacher_id ?? `anon-${bucket.rowCount}`);
      byBase.set(base, bucket);
    }
  }
  const out: ElectiveImportCluster[] = [];
  for (const [base, v] of byBase) {
    let members = sortClassSections([...v.sections]);
    if (members.length < 2 && (v.teacherKeys.size >= 2 || v.subjects.size >= 2)) {
      const n = Math.max(2, v.teacherKeys.size, v.subjects.size);
      members = Array.from({ length: n }, (_, i) => `${base}-S${i + 1}`);
    }
    if (members.length < 2) continue;
    out.push({
      base_section: base,
      member_sections: members,
      subject_names: [...v.subjects],
    });
  }
  return out;
}

/** AİHL haftalık ders üst sınırları (MEB özet — idare kontrolü) */
export const AIHL_WEEKLY_NORM: Record<string, number> = {
  'kur\'an-ı kerim': 4,
  'kuran-i kerim': 4,
  'kuran': 4,
  'peygamberimizin hayatı': 2,
  'temel dini bilgiler': 6,
  'temel dini bilgileri': 6,
};

export type AihlNormIssue = { subject_name: string; assigned: number; max: number; severity: 'error' | 'warning' };

export function checkAihlWeeklyNorm(
  profile: StudioSchoolProfile,
  assignments: Array<{ subject_name: string; weekly_hours: number; class_sections: string[] }>,
): AihlNormIssue[] {
  if (profile.type !== 'aihl') return [];
  const issues: AihlNormIssue[] = [];
  const bySubject = new Map<string, number>();
  for (const a of assignments) {
    const key = normalizeWhitespace(a.subject_name).toLowerCase();
    bySubject.set(key, (bySubject.get(key) ?? 0) + a.weekly_hours);
  }
  for (const [sub, hrs] of bySubject) {
    for (const [pattern, max] of Object.entries(AIHL_WEEKLY_NORM)) {
      if (!sub.includes(pattern)) continue;
      if (hrs > max) {
        issues.push({
          subject_name: sub,
          assigned: hrs,
          max,
          severity: 'error',
        });
      }
    }
  }
  return issues;
}
