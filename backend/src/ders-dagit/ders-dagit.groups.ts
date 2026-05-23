/** Paralel ders grupları — üç mod */

import type { MebSchoolType } from './ders-dagit.school-profile';
import { defaultGroupModeForSchool } from './ders-dagit.group-presets';

export type DersDagitGroupMode = 'parallel_rooms' | 'subgroups' | 'teacher_multi_class';

export type GroupModeCatalogEntry = {
  mode: DersDagitGroupMode;
  label_tr: string;
  hint_tr: string;
  /** Okul türünde önerilen mod (sıralama için) */
  recommended?: boolean;
};

const GROUP_MODE_CATALOG_ALL: Array<GroupModeCatalogEntry & { recommend?: MebSchoolType[] }> = [
  {
    mode: 'subgroups',
    label_tr: 'Alt gruplar (bölünmüş şubeler)',
    hint_tr: '5A-A / 5A-B, seçmeli kollar — aynı ders, aynı saat, farklı alt şube.',
    recommend: ['ilkokul', 'ortaokul', 'anadolu_lise', 'fen_lise', 'aihl', 'mtal'],
  },
  {
    mode: 'parallel_rooms',
    label_tr: 'Paralel derslik (aynı saat, farklı odalar)',
    hint_tr: 'Beden/müzik bölünmesi, meslek atölyesi, seçmeli — şubeler aynı anda farklı derslikte.',
    recommend: ['mtal', 'anadolu_lise', 'fen_lise', 'aihl'],
  },
  {
    mode: 'teacher_multi_class',
    label_tr: 'Öğretmen çoklu sınıf',
    hint_tr: 'Öğretmen tek saatte birden fazla şubede; birleşik şube atamaları.',
    recommend: ['anadolu_lise', 'fen_lise', 'mtal', 'aihl'],
  },
];

export const GROUP_MODE_CATALOG: GroupModeCatalogEntry[] = GROUP_MODE_CATALOG_ALL.map(
  ({ recommend: _r, ...rest }) => rest,
);

export function groupModeCatalogForSchool(schoolType: MebSchoolType | string): GroupModeCatalogEntry[] {
  const t = schoolType as MebSchoolType;
  return GROUP_MODE_CATALOG_ALL.map((row) => ({
    mode: row.mode,
    label_tr: row.label_tr,
    hint_tr: row.hint_tr,
    recommended: row.recommend?.includes(t) ?? false,
  })).sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

export function normalizeGroupMode(
  raw: string | null | undefined,
  schoolType?: MebSchoolType | string,
): DersDagitGroupMode {
  if (raw === 'subgroups' || raw === 'teacher_multi_class' || raw === 'parallel_rooms') {
    return raw;
  }
  if (raw === 'parallel') return 'parallel_rooms';
  return defaultGroupModeForSchool(schoolType ?? 'anadolu_lise');
}
