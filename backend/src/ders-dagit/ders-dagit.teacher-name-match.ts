import type { User } from '../users/entities/user.entity';
import { normalizeTeacherDisplayName } from '../common/utils/teacher-display-name.util';

const TITLE_PREFIX =
  /^(dr|prof|doç|doc|öğr|ogrt|öğretmen|ogretmen|sn|sayın|sayin|uç|uc)\.?\s+/iu;

export type AscTeacherMeta = {
  email?: string;
  mobile?: string;
  partner_id?: string;
  short?: string;
};

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

export function teacherTcKimlik(u: User): string | null {
  const raw = u.evrakDefaults?.yolluk_teacher?.tc_kimlik?.trim().replace(/\D/g, '') ?? '';
  return raw.length === 11 ? raw : null;
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

export function findTeacherByTc(teachers: User[], tc: string): User | null {
  const norm = tc.replace(/\D/g, '');
  if (norm.length !== 11) return null;
  return teachers.find((u) => teacherTcKimlik(u) === norm) ?? null;
}

export function findTeacherByEmail(teachers: User[], email: string): User | null {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes('@')) return null;
  return teachers.find((u) => u.email.trim().toLowerCase() === e) ?? null;
}

function emailLocalNameTokens(email: string): string[] {
  const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
  return local
    .split(/[._-]+/)
    .map((t) => normalizeTeacherNameKey(t))
    .filter(Boolean);
}

function findTeacherByEmailLocalPart(teachers: User[], importedName: string): User | null {
  const impTok = nameTokens(importedName);
  if (impTok.length < 2) return null;
  const hits = teachers.filter((u) => {
    const loc = emailLocalNameTokens(u.email);
    if (loc.length < 2) return false;
    return tokenSetsEqual(impTok, loc) || surnameFirstMatch(impTok, loc);
  });
  return hits.length === 1 ? hits[0]! : null;
}

function findTeacherByUniqueToken(teachers: User[], importedName: string): User | null {
  const tok = nameTokens(importedName);
  if (!tok.length) return null;
  for (const token of [tok[tok.length - 1]!, tok[0]!]) {
    if (!token || token.length < 3) continue;
    const hits = teachers.filter((u) => {
      const dt = nameTokens(u.display_name ?? '');
      return dt.includes(token);
    });
    if (hits.length === 1) return hits[0]!;
  }
  return null;
}

export function findTeacherByImportedName(
  teachers: User[],
  importedName: string,
): User | null {
  const q = importedName.trim();
  if (!q) return null;
  if (q.includes('@')) {
    const byEmail = findTeacherByEmail(teachers, q);
    if (byEmail) return byEmail;
  }
  const tcDigits = q.replace(/\D/g, '');
  if (tcDigits.length === 11) {
    const byTc = findTeacherByTc(teachers, tcDigits);
    if (byTc) return byTc;
  }
  const exactDisplay = teachers.find(
    (u) => normalizeTeacherDisplayName(u.display_name) === normalizeTeacherDisplayName(q),
  );
  if (exactDisplay) return exactDisplay;
  const exactKey = teachers.find(
    (u) => normalizeTeacherNameKey(u.display_name ?? '') === normalizeTeacherNameKey(q),
  );
  if (exactKey) return exactKey;
  const fuzzy =
    teachers.find((u) => teacherDisplayNamesMatch(q, u.display_name ?? '')) ??
    teachers.find((u) => teacherDisplayNamesMatch(q, u.email.split('@')[0] ?? ''));
  if (fuzzy) return fuzzy;
  return findTeacherByEmailLocalPart(teachers, q) ?? findTeacherByUniqueToken(teachers, q);
}

export function resolveImportedTeacherIds(
  teachers: User[],
  tc: string | null,
  names: string[],
): { user_ids: string[]; warnings: string[] } {
  return resolveImportedTeacherIdsWithAsc(teachers, tc, names, [], {}, {});
}

/** aSc öğretmen id → ad / TC / e-posta ile eşleştirme */
export function resolveImportedTeacherIdsWithAsc(
  teachers: User[],
  tc: string | null,
  names: string[],
  teacherAscIds: string[],
  matchNamesByAscId: Record<string, string[]>,
  teacherMetaByAscId: Record<string, AscTeacherMeta> = {},
): { user_ids: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const ids: string[] = [];
  const tryAdd = (user: User | null | undefined) => {
    if (user && !ids.includes(user.id)) ids.push(user.id);
  };

  if (tc) {
    const hit = findTeacherByTc(teachers, tc);
    if (hit) return { user_ids: [hit.id], warnings };
    warnings.push(`TC eşleşmedi: ${tc}`);
    return { user_ids: [], warnings };
  }

  for (const ascId of teacherAscIds) {
    const meta = teacherMetaByAscId[ascId];
    if (meta?.partner_id?.trim()) {
      const partner = meta.partner_id.trim();
      const digits = partner.replace(/\D/g, '');
      if (digits.length === 11) tryAdd(findTeacherByTc(teachers, digits));
      else tryAdd(findTeacherByImportedName(teachers, partner));
    }
    if (meta?.email?.trim()) tryAdd(findTeacherByEmail(teachers, meta.email));
    if (meta?.mobile?.trim()) {
      const mobileDigits = meta.mobile.replace(/\D/g, '');
      if (mobileDigits.length === 11) tryAdd(findTeacherByTc(teachers, mobileDigits));
    }
  }

  const candidates = new Set<string>();
  for (const n of names.map((x) => x.trim()).filter(Boolean)) candidates.add(n);
  for (const ascId of teacherAscIds) {
    for (const v of matchNamesByAscId[ascId] ?? []) {
      if (v.trim()) candidates.add(v.trim());
    }
  }

  for (const name of candidates) {
    tryAdd(findTeacherByImportedName(teachers, name));
  }

  const unique = [...new Set(ids)];
  if (!unique.length && (candidates.size || teacherAscIds.length)) {
    const label = [...candidates][0] ?? teacherAscIds[0] ?? '?';
    warnings.push(`Öğretmen eşleşmedi: ${label}`);
  }
  return { user_ids: unique, warnings };
}
