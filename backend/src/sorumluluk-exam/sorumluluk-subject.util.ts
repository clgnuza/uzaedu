import type { SubjectEntry } from './entities/sorumluluk-student.entity';

export type NormalizedSubject = {
  subjectName: string;
  gradeLevel: number | null;
  matchKey: string;
};

export function normalizeSorumluSubject(raw: string): NormalizedSubject {
  const t = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return { subjectName: '', gradeLevel: null, matchKey: '' };

  const m = t.match(/^(\d{1,2})\s+(.+)$/u);
  if (m) {
    const grade = parseInt(m[1], 10);
    const base = m[2].trim();
    return {
      subjectName: t,
      gradeLevel: grade,
      matchKey: `${grade}|${base.toLocaleLowerCase('tr-TR')}`,
    };
  }
  return { subjectName: t, gradeLevel: null, matchKey: t.toLocaleLowerCase('tr-TR') };
}

export function subjectMatchKey(entry: Pick<SubjectEntry, 'subjectName' | 'gradeLevel'>): string {
  if (entry.gradeLevel != null) {
    const parsed = normalizeSorumluSubject(entry.subjectName);
    if (parsed.gradeLevel != null) return parsed.matchKey;
    const base = entry.subjectName.trim().toLocaleLowerCase('tr-TR');
    return `${entry.gradeLevel}|${base}`;
  }
  return normalizeSorumluSubject(entry.subjectName).matchKey;
}

export function formatSubjectLabel(entry: Pick<SubjectEntry, 'subjectName' | 'gradeLevel'>): string {
  const name = entry.subjectName.trim();
  if (/^\d{1,2}\s+/.test(name)) return name;
  if (entry.gradeLevel != null) return `${entry.gradeLevel}. Sınıf ${name}`;
  return name;
}

export function toSubjectEntry(raw: string, sessionId?: string | null): SubjectEntry {
  const n = normalizeSorumluSubject(raw);
  return { subjectName: n.subjectName, gradeLevel: n.gradeLevel, sessionId: sessionId ?? null };
}

export function uniqueSubjectDisplayNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const n = normalizeSorumluSubject(raw);
    if (!n.matchKey) continue;
    if (!seen.has(n.matchKey)) seen.set(n.matchKey, n.subjectName);
  }
  return [...seen.values()];
}

/** MEB import: ders adları veya matchKey listesi → eşleştirme anahtarı kümesi */
export function parseMixedSubjectKeys(raw: string | string[] | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  let items: string[] = [];
  if (Array.isArray(raw)) items = raw;
  else {
    const t = raw.trim();
    if (!t) return out;
    try {
      const parsed = JSON.parse(t) as unknown;
      items = Array.isArray(parsed) ? parsed.map(String) : t.split(/[,;\n]+/);
    } catch {
      items = t.split(/[,;\n]+/);
    }
  }
  for (const item of items) {
    const n = normalizeSorumluSubject(String(item).trim());
    if (n.matchKey) out.add(n.matchKey);
  }
  return out;
}
