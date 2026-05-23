import { compareClassSections } from './class-section-sort';

export const DAY_LABELS: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

export type ExportEntry = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  user_id?: string | null;
  teacher_label?: string | null;
  room_id?: string | null;
  room_name?: string | null;
};

export function escCsv(v: string): string {
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Sınıf bazlı satır listesi (Excel’e açılır). */
export function buildProgramGridCsv(entries: ExportEntry[]): string {
  const rows = ['Sinif;Gun;DersNo;Ders;Ogretmen;Derslik'];
  const sorted = [...entries].sort(
    (a, b) =>
      compareClassSections(a.class_section, b.class_section) ||
      a.day_of_week - b.day_of_week ||
      a.lesson_num - b.lesson_num,
  );
  for (const e of sorted) {
    rows.push(
      [
        escCsv(e.class_section),
        escCsv(DAY_LABELS[e.day_of_week] ?? String(e.day_of_week)),
        String(e.lesson_num),
        escCsv(e.subject),
        escCsv(e.teacher_label ?? e.user_id?.slice(0, 8) ?? ''),
        escCsv(e.room_name ?? ''),
      ].join(';'),
    );
  }
  return rows.join('\n');
}

/** Atama içe aktarma şablonu. */
export function buildAssignmentImportTemplateXlsx(): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const ws = XLSX.utils.json_to_sheet([
    {
      Ders: 'Matematik',
      Sinif: '5A',
      Saat: 4,
      OgretmenId: '',
      DerslikId: '',
      IkiHf: 0,
      Once: 0,
      MinGun: 2,
      MaxGun: 2,
      MaxGunHf: '',
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atamalar');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Excel (.xlsx) — sınıf programı tablosu. */
export function buildProgramGridXlsx(entries: ExportEntry[]): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const rows = [...entries]
    .sort(
      (a, b) =>
        compareClassSections(a.class_section, b.class_section) ||
        a.day_of_week - b.day_of_week ||
        a.lesson_num - b.lesson_num,
    )
    .map((e) => ({
      Sinif: e.class_section,
      Gun: DAY_LABELS[e.day_of_week] ?? e.day_of_week,
      DersNo: e.lesson_num,
      Ders: e.subject,
      Ogretmen: e.teacher_label ?? '',
      Derslik: e.room_name ?? '',
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Program');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

