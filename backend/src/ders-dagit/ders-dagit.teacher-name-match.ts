import type { User } from '../users/entities/user.entity';

const TITLE_PREFIX =
  /^(dr|prof|doç|doc|öğr|ogrt|öğretmen|ogretmen|sn|sayın|sayin|uç|uc)\.?\s+/iu;

export function normalizeTeacherNameKey(name: string): string {
  return name
    .trim()
    .replace(TITLE_PREFIX, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-ZÇĞİÖŞÜ\s]/g, '')
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeTeacherNameKey(name).split(/\s+/).filter(Boolean);
}

function tokenSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join('\0');
  const sb = [...b].sort().join('\0');
  return sa === sb;
}

function surnameFirstMatch(a: string[], b: string[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  return a[0] === b[b.length - 1] && a[a.length - 1] === b[0];
}

function abbreviatedMatch(imported: string[], display: string[]): boolean {
  if (imported.length < 2 || display.length < 2) return false;
  const impSurname = imported[0]!;
  const impRest = imported.slice(1).join(' ');
  const impInitial = impRest.replace(/\./g, '').trim()[0];
  const displayHasSurname = display.some((t) => t === impSurname || t.startsWith(impSurname));
  if (!displayHasSurname) return false;
  if (!impInitial) return displayHasSurname;
  return display.some((t) => t[0] === impInitial && t !== impSurname);
}

export function teacherDisplayNamesMatch(imported: string, display: string): boolean {
  const a = nameTokens(imported);
  const b = nameTokens(display);
  if (!a.length || !b.length) return false;
  if (a.join(' ') === b.join(' ')) return true;
  if (tokenSetsEqual(a, b)) return true;
  if (surnameFirstMatch(a, b)) return true;
  if (abbreviatedMatch(a, b)) return true;
  const setA = new Set(a);
  const overlap = b.filter((t) => setA.has(t)).length;
  return overlap >= 2 && overlap >= Math.min(a.length, b.length);
}

export function findTeacherByImportedName(
  teachers: User[],
  importedName: string,
): User | null {
  const q = importedName.trim();
  if (!q) return null;
  const exact = teachers.find(
    (u) => normalizeTeacherNameKey(u.display_name ?? '') === normalizeTeacherNameKey(q),
  );
  if (exact) return exact;
  return teachers.find((u) => teacherDisplayNamesMatch(q, u.display_name ?? u.email ?? '')) ?? null;
}

export function resolveImportedTeacherIds(
  teachers: User[],
  tc: string | null,
  names: string[],
): { user_ids: string[]; warnings: string[] } {
  return resolveImportedTeacherIdsWithAsc(teachers, tc, names, [], {});
}

/** aSc öğretmen id → ad varyantları (name, ad soyad, soyad ad, kısa ad) ile eşleştirme */
export function resolveImportedTeacherIdsWithAsc(
  teachers: User[],
  tc: string | null,
  names: string[],
  teacherAscIds: string[],
  matchNamesByAscId: Record<string, string[]>,
): { user_ids: string[]; warnings: string[] } {
  const warnings: string[] = [];
  if (tc) {
    const hit = teachers.find((u) => u.evrakDefaults?.yolluk_teacher?.tc_kimlik === tc);
    if (hit) return { user_ids: [hit.id], warnings };
    warnings.push(`TC eşleşmedi: ${tc}`);
    return { user_ids: [], warnings };
  }
  const candidates = new Set<string>();
  for (const n of names.map((x) => x.trim()).filter(Boolean)) candidates.add(n);
  for (const ascId of teacherAscIds) {
    for (const v of matchNamesByAscId[ascId] ?? []) {
      if (v.trim()) candidates.add(v.trim());
    }
  }
  const ids: string[] = [];
  for (const name of candidates) {
    const hit = findTeacherByImportedName(teachers, name);
    if (hit) ids.push(hit.id);
  }
  const unique = [...new Set(ids)];
  if (!unique.length && candidates.size) {
    warnings.push(`Öğretmen eşleşmedi: ${[...candidates][0]}`);
  }
  return { user_ids: unique, warnings };
}
