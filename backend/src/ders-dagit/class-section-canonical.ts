import { foldTurkish } from '../teacher-timetable/timetable-reconcile/normalize';
import { compareClassSections, parseGradeFromClassSection, sortClassSections } from './class-section-sort';

export function isVerboseSectionName(section: string): boolean {
  const u = section.trim().toLocaleUpperCase('tr');
  return /\(|\)|AMP|ALAN|HİZMET|BÖLÜM|SAĞLIK|TEKNİK|MESLEK/u.test(u);
}

function parseBranchKey(section: string): string {
  const s = section.trim();
  let m = s.match(/(?:^|[^\d])(1[0-2]|[1-9])\s*[\/.\-]\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/iu);
  if (m) return m[2]!.toLocaleLowerCase('tr-TR');
  m = s.match(/(?:^|[^\d])(1[0-2]|[1-9])\s*[-–]\s*([A-Za-zÇĞİÖŞÜçğıöşü])/iu);
  if (m) return m[2]!.toLocaleLowerCase('tr-TR');
  m = s.match(/(?:^|[^\d])(1[0-2]|[1-9])([A-Za-zÇĞİÖŞÜçğıöşü]{1,3})(?:\s|$|\()/iu);
  if (m) return m[2]!.toLocaleLowerCase('tr-TR');
  return '';
}

export function sectionIdentityKey(section: string): string {
  const grade = parseGradeFromClassSection(section);
  const branch = parseBranchKey(section);
  if (grade < 99 && branch) return `${grade}:${branch}`;
  return `raw:${section.trim().toLocaleLowerCase('tr-TR')}`;
}

/** Aynı şubenin kısa/uzun adları → okul kaydı (uzun) tercih */
function pickCanonicalSectionName(candidates: string[]): string {
  if (candidates.length <= 1) return candidates[0] ?? '';
  const verbose = candidates.filter(isVerboseSectionName);
  const pool = verbose.length ? verbose : candidates;
  return [...pool].sort((a, b) => b.length - a.length || compareClassSections(a, b))[0]!;
}

export function dedupeSectionAliases(sections: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const s of sections) {
    const key = sectionIdentityKey(s);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return sortClassSections([...groups.values()].map(pickCanonicalSectionName));
}

/** Tüm yazılışlar → tek resmi şube adı */
export function buildSectionAliasMap(sections: string[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const s of sections) {
    const key = sectionIdentityKey(s);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  const out = new Map<string, string>();
  for (const cands of groups.values()) {
    const canon = pickCanonicalSectionName(cands);
    for (const c of cands) out.set(c, canon);
  }
  return out;
}

export function sectionsEquivalent(a: string, b: string): boolean {
  return sectionIdentityKey(a) === sectionIdentityKey(b);
}

/** Derslik listesinde şube adından ayırt etmek için (görünen ad) */
export const CLASSROOM_DISPLAY_SUFFIX = ' · derslik';

export function formatClassroomDisplayName(section: string): string {
  const s = section.trim();
  if (!s) return 'Derslik';
  const low = s.toLocaleLowerCase('tr');
  if (low.endsWith('derslik') || s.includes(CLASSROOM_DISPLAY_SUFFIX)) return s;
  return `${s}${CLASSROOM_DISPLAY_SUFFIX}`;
}

export function sectionFromClassroomDisplayName(roomName: string): string | null {
  const t = roomName.trim();
  if (!t.endsWith(CLASSROOM_DISPLAY_SUFFIX)) return null;
  const base = t.slice(0, -CLASSROOM_DISPLAY_SUFFIX.length).trim();
  return base || null;
}

/** Oda / derslik kaydı hangi şubeye ait */
export function sectionKeyFromRoomFields(name: string, allowed?: string[] | null): string | null {
  const fromDisplay = sectionFromClassroomDisplayName(name);
  const candidates = [fromDisplay, ...(allowed ?? []), name]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  for (const c of candidates) {
    const k = sectionIdentityKey(c);
    if (!k.startsWith('raw:')) return k;
  }
  return candidates[0] ? sectionIdentityKey(candidates[0]) : null;
}

/** Liste öğelerini tek resmi şube adına çevirir (sırayı korur, tekrarları birleştirmez). */
export function normalizeClassSectionNamesFromPool(sections: string[], pool: string[]): string[] {
  const aliasMap = buildSectionAliasMap([...pool, ...sections.map((s) => s.trim()).filter(Boolean)]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    const t = s?.trim();
    if (!t) continue;
    const canon = aliasMap.get(t) ?? t;
    if (seen.has(canon)) continue;
    seen.add(canon);
    out.push(canon);
  }
  return sortClassSections(out);
}

export function effectiveAssignmentWeeklyHours(weeklyHours: number, biweekly?: boolean): number {
  const h = Math.max(0, Number(weeklyHours) || 0);
  if (!h) return 0;
  return biweekly ? Math.ceil(h / 2) : h;
}

/** Atama satırlarından şube başına haftalık saat (katalog dahil edilmez; aynı ders+şube tekrarı tek sayılır). */
export function buildWeeklyHoursFromAssignments(
  assignments: Array<{
    subject_name?: string | null;
    class_sections?: string[];
    weekly_hours: number;
    biweekly?: boolean;
  }>,
): Record<string, number> {
  const bySubjectSection = new Map<string, { hours: number; section: string }>();
  for (const a of assignments) {
    const hrs = effectiveAssignmentWeeklyHours(a.weekly_hours, a.biweekly);
    if (hrs <= 0) continue;
    const subj = foldTurkish(String(a.subject_name ?? '').trim()).toUpperCase();
    for (const sec of a.class_sections ?? []) {
      const t = sec.trim();
      if (!t) continue;
      const k = `${subj}\0${sectionIdentityKey(t)}`;
      const prev = bySubjectSection.get(k);
      if (!prev || hrs > prev.hours) {
        bySubjectSection.set(k, { hours: hrs, section: t });
      }
    }
  }
  const entries = [...bySubjectSection.values()];
  const aliasMap = buildSectionAliasMap(entries.map((e) => e.section));
  const raw: Record<string, number> = {};
  for (const { hours, section } of entries) {
    const canon = aliasMap.get(section.trim()) ?? section.trim();
    raw[canon] = (raw[canon] ?? 0) + hours;
  }
  return raw;
}

export function mergeClassHoursBySectionAlias(record: Record<string, number>): Record<string, number> {
  const raw = Object.keys(record ?? {});
  const aliasMap = buildSectionAliasMap([...raw, ...dedupeSectionAliases(raw)]);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record ?? {})) {
    const canon = aliasMap.get(k.trim()) ?? k.trim();
    if (!canon) continue;
    const n = Math.max(0, Number(v) || 0);
    if (n === 0) continue;
    out[canon] = Math.max(out[canon] ?? 0, n);
  }
  return out;
}

export function roomCoversSection(
  roomName: string,
  allowed: string[] | null | undefined,
  section: string,
): boolean {
  const fromName = sectionFromClassroomDisplayName(roomName);
  if (fromName && sectionsEquivalent(fromName, section)) return true;
  if (sectionsEquivalent(roomName, section)) return true;
  for (const a of allowed ?? []) {
    if (sectionsEquivalent(a, section)) return true;
  }
  return false;
}
