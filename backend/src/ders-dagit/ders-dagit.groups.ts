/** Horarium Gruplar (#divisions) — üç mod */

export type DersDagitGroupMode = 'parallel_rooms' | 'subgroups' | 'teacher_multi_class';

export const GROUP_MODE_CATALOG: Array<{
  mode: DersDagitGroupMode;
  label_tr: string;
  horarium_ref: string;
}> = [
  {
    mode: 'parallel_rooms',
    label_tr: 'Aynı sınıf, aynı anda farklı odalarda',
    horarium_ref: 'ayn-snftaki-ogrenciler-ayn-anda-farkl-odalarda',
  },
  {
    mode: 'subgroups',
    label_tr: 'Alt gruplar (aynı ders/öğretmen, bölünmüş şubeler)',
    horarium_ref: 'alt-gruplara-ayrmak',
  },
  {
    mode: 'teacher_multi_class',
    label_tr: 'Öğretmen aynı anda birden fazla sınıfa',
    horarium_ref: 'birden-fazla-snftaki-ogrencilere',
  },
];

export function normalizeGroupMode(raw: string | null | undefined): DersDagitGroupMode {
  if (raw === 'subgroups' || raw === 'teacher_multi_class' || raw === 'parallel_rooms') {
    return raw;
  }
  if (raw === 'parallel_rooms' || raw === 'parallel') return 'parallel_rooms';
  return 'parallel_rooms';
}
