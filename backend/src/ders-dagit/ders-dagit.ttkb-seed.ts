/** Faz 39 — TTKB / Maarif ders kataloğu → stüdyo dersleri */

import { getDersSaatiStatic } from '../config/ders-saati';
import {
  getSubjectsByGradeAndSection,
  type SectionKey,
  type SubjectEntry,
} from '../config/document-template-subjects';
import type { MebSchoolType } from './ders-dagit.school-profile';
import { isElectiveSubjectName } from './ders-dagit.elective';

export type TtkbSeedCell = {
  subject_code: string;
  subject_name: string;
  class_section: string;
  grade: number;
  weekly_hours: number;
  source: 'ttkb' | 'yillik_plan' | 'document_catalog';
  is_elective: boolean;
};

export function gradeFromClassSection(section: string): number | null {
  const t = section.trim();
  if (!t) return null;
  // 9/A, 10-BT, AMP - 9/A (alan) — sınıf numarası şube metninin ortasında da olabilir
  const classLike = /(?:^|[^\d])(\d{1,2})\s*[/.\-]\s*[A-Za-zğüşıöçĞÜŞİÖÇ0-9]/u.exec(t);
  if (classLike) {
    const g = parseInt(classLike[1]!, 10);
    if (g >= 1 && g <= 12) return g;
  }
  const head = /^(\d{1,2})\s*[-./]?\s*/i.exec(t);
  if (head) {
    const g = parseInt(head[1]!, 10);
    if (g >= 1 && g <= 12) return g;
  }
  const tail = /(?:^|[^\d])(\d{1,2})\s*$/i.exec(t);
  if (tail) {
    const g = parseInt(tail[1]!, 10);
    if (g >= 1 && g <= 12) return g;
  }
  return null;
}

export function sectionKeyForSchoolType(type: MebSchoolType, grade: number): SectionKey | undefined {
  if (type === 'aihl') return grade >= 9 ? 'ihl' : 'iho';
  if (type === 'mtal') return 'meslek';
  if (type === 'fen_lise') return 'ders';
  return 'ders';
}

/** Kurum türüne göre TTKB sınıf seviyeleri (şube listesi gerekmez). */
export function gradesForSchoolType(type: MebSchoolType): number[] {
  if (type === 'ilkokul') return [1, 2, 3, 4];
  if (type === 'ortaokul') return [5, 6, 7, 8];
  return [9, 10, 11, 12];
}

export type TtkbCatalogRow = {
  subject_code: string;
  subject_name: string;
  grade: number;
  weekly_hours: number;
  source: TtkbSeedCell['source'];
  is_elective: boolean;
};

/** TTKB kategori 7 — kurum türü + sınıf seviyesi; şubeye otomatik dağıtım yok. */
export function buildTtkbCatalogBySchoolType(
  schoolType: MebSchoolType,
  yillikByGradeCode: Map<string, { label: string; hours: number }>,
): TtkbCatalogRow[] {
  const rows: TtkbCatalogRow[] = [];
  const seen = new Set<string>();
  for (const grade of gradesForSchoolType(schoolType)) {
    const sectionKey = sectionKeyForSchoolType(schoolType, grade);
    const yillikForGrade = new Map<string, number>();
    for (const [k, v] of yillikByGradeCode) {
      const [code, gStr] = k.split('\0');
      if (Number(gStr) === grade) yillikForGrade.set(code, v.hours);
    }
    for (const row of buildTtkbCatalogForGrade(grade, sectionKey, yillikForGrade)) {
      const key = `${row.entry.code}\0${grade}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        subject_code: row.entry.code,
        subject_name: row.entry.label,
        grade,
        weekly_hours: row.weekly_hours,
        source: row.source,
        is_elective: isElectiveSubjectName(row.entry.label) || row.entry.code.includes('secmeli'),
      });
    }
  }
  return rows;
}

/** 9–12 TTKB seçmeli / ikinci yabancı dil ve sanat-spor kolları */
const LISE_ELECTIVE_CODES = new Set([
  'almanca',
  'fransizca',
  'ispanyolca',
  'rusca',
  'gorsel_sanatlar',
  'muzik',
  'beden_egitimi',
  'bilgisayar_bilimi',
]);

function electiveSectionKeysForGrade(type: MebSchoolType, grade: number): SectionKey[] {
  if (grade < 5 || grade > 8) return [];
  if (type === 'aihl') return ['secmeli', 'iho'];
  return ['secmeli'];
}

function isLiseElectiveEntry(code: string, label: string): boolean {
  return LISE_ELECTIVE_CODES.has(normalizeCode(code)) || isElectiveSubjectName(label);
}

/** Kurum türüne göre yalnızca seçmeli TTKB dersleri (5–8: secmeli/iho; 9–12: seçmeli kodlar). */
export function buildTtkbElectiveCatalogBySchoolType(
  schoolType: MebSchoolType,
  yillikByGradeCode: Map<string, { label: string; hours: number }>,
): TtkbCatalogRow[] {
  const rows: TtkbCatalogRow[] = [];
  const seen = new Set<string>();

  for (const grade of gradesForSchoolType(schoolType)) {
    const yillikForGrade = new Map<string, number>();
    for (const [k, v] of yillikByGradeCode) {
      const [code, gStr] = k.split('\0');
      if (Number(gStr) === grade) yillikForGrade.set(code, v.hours);
    }

    if (grade >= 5 && grade <= 8) {
      for (const sk of electiveSectionKeysForGrade(schoolType, grade)) {
        for (const row of buildTtkbCatalogForGrade(grade, sk, yillikForGrade)) {
          const key = `${row.entry.code}\0${grade}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            subject_code: row.entry.code,
            subject_name: row.entry.label,
            grade,
            weekly_hours: row.weekly_hours,
            source: row.source,
            is_elective: true,
          });
        }
      }
    } else if (grade >= 9 && grade <= 12) {
      const sectionKey = sectionKeyForSchoolType(schoolType, grade);
      for (const row of buildTtkbCatalogForGrade(grade, sectionKey, yillikForGrade)) {
        if (!isLiseElectiveEntry(row.entry.code, row.entry.label)) continue;
        const key = `${row.entry.code}\0${grade}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          subject_code: row.entry.code,
          subject_name: row.entry.label,
          grade,
          weekly_hours: row.weekly_hours,
          source: row.source,
          is_elective: true,
        });
      }
    }
  }
  return rows;
}

/** Ders kataloğu — şube/sınıf ataması yapılmaz (class_hours boş). */
export function mergeGradeCatalogToSubjects(
  rows: TtkbCatalogRow[],
): Map<string, { name: string; short_code: string; class_hours: Record<string, number>; is_elective: boolean }> {
  const map = new Map<
    string,
    { name: string; short_code: string; class_hours: Record<string, number>; is_elective: boolean }
  >();
  for (const r of rows) {
    const code = fitSubjectShortCode(r.subject_code);
    const prev = map.get(code) ?? {
      name: r.subject_name,
      short_code: code,
      class_hours: {},
      is_elective: r.is_elective,
    };
    prev.is_elective = prev.is_elective || r.is_elective;
    map.set(code, prev);
  }
  return map;
}

export function catalogRowsToPreviewCells(rows: TtkbCatalogRow[]): Array<{
  subject_code: string;
  subject_name: string;
  class_section: string;
  grade: number;
  weekly_hours: number;
  source: TtkbSeedCell['source'];
}> {
  return rows.map((r) => ({
    subject_code: r.subject_code,
    subject_name: r.subject_name,
    class_section: '',
    grade: r.grade,
    weekly_hours: r.weekly_hours,
    source: r.source,
  }));
}

function normalizeCode(code: string): string {
  return (code ?? '').toLowerCase().trim().replace(/_maarif(_[a-z]+)?$/, '').replace(/_maarif$/, '');
}

const SHORT_CODE_MAX = 16;

/** DB short_code varchar(16) — uzun TTKB kodlarını kısaltır. */
export function fitSubjectShortCode(code: string): string {
  const n = normalizeCode(code);
  if (n.length <= SHORT_CODE_MAX) return n;
  const tail = n.slice(-(SHORT_CODE_MAX - 1));
  return `${n.charAt(0)}${tail}`.slice(0, SHORT_CODE_MAX);
}

export function buildTtkbCatalogForGrade(
  grade: number,
  sectionKey: SectionKey | undefined,
  yillikHours: Map<string, number>,
): Array<{ entry: SubjectEntry; weekly_hours: number; source: TtkbSeedCell['source'] }> {
  const catalog = getSubjectsByGradeAndSection(grade, sectionKey);
  const out: Array<{ entry: SubjectEntry; weekly_hours: number; source: TtkbSeedCell['source'] }> = [];
  for (const entry of catalog) {
    const code = normalizeCode(entry.code);
    const fromPlan = yillikHours.get(`${code}\0${grade}`);
    const hours =
      fromPlan != null && fromPlan > 0
        ? fromPlan
        : getDersSaatiStatic(entry.code, grade);
    if (hours < 1) continue;
    out.push({
      entry,
      weekly_hours: hours,
      source: fromPlan != null && fromPlan > 0 ? 'yillik_plan' : 'ttkb',
    });
  }
  return out;
}

export function buildTtkbSeedCells(
  sections: string[],
  schoolType: MebSchoolType,
  yillikByGradeCode: Map<string, { label: string; hours: number }>,
): TtkbSeedCell[] {
  const cells: TtkbSeedCell[] = [];
  const seen = new Set<string>();

  for (const sec of sections) {
    const grade = gradeFromClassSection(sec);
    if (!grade) continue;
    const sectionKey = sectionKeyForSchoolType(schoolType, grade);
    const yillikForGrade = new Map<string, number>();
    for (const [k, v] of yillikByGradeCode) {
      const [code, gStr] = k.split('\0');
      if (Number(gStr) === grade) yillikForGrade.set(code, v.hours);
    }
    const rows = buildTtkbCatalogForGrade(grade, sectionKey, yillikForGrade);
    for (const row of rows) {
      const key = `${row.entry.code}\0${sec}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({
        subject_code: row.entry.code,
        subject_name: row.entry.label,
        class_section: sec,
        grade,
        weekly_hours: row.weekly_hours,
        source: row.source,
        is_elective: isElectiveSubjectName(row.entry.label) || row.entry.code.includes('secmeli'),
      });
    }
  }
  return cells;
}

/** Stüdyo ders kaydı: kod → { name, class_hours, is_elective } */
export function mergeCellsToSubjects(
  cells: TtkbSeedCell[],
): Map<string, { name: string; short_code: string; class_hours: Record<string, number>; is_elective: boolean }> {
  const map = new Map<
    string,
    { name: string; short_code: string; class_hours: Record<string, number>; is_elective: boolean }
  >();
  for (const c of cells) {
    const code = fitSubjectShortCode(c.subject_code);
    const prev = map.get(code) ?? {
      name: c.subject_name,
      short_code: code,
      class_hours: {},
      is_elective: c.is_elective,
    };
    prev.class_hours[c.class_section] = Math.max(prev.class_hours[c.class_section] ?? 0, c.weekly_hours);
    prev.is_elective = prev.is_elective || c.is_elective;
    map.set(code, prev);
  }
  return map;
}
