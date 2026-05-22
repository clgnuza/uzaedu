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
  room_name?: string | null;
};

function escCsv(v: string): string {
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Sınıf bazlı satır listesi (Excel’e açılır). */
export function buildProgramGridCsv(entries: ExportEntry[]): string {
  const rows = ['Sinif;Gun;DersNo;Ders;Ogretmen;Derslik'];
  const sorted = [...entries].sort(
    (a, b) =>
      a.class_section.localeCompare(b.class_section, 'tr') ||
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

/** e-Okul / MEB dışa aktarım iskeleti (noktalı virgül). */
export function buildEokulScheduleCsv(entries: ExportEntry[]): string {
  const rows = ['Sinif;GunNo;DersSirasi;DersAdi;Ogretmen'];
  const sorted = [...entries].sort(
    (a, b) =>
      a.class_section.localeCompare(b.class_section, 'tr') ||
      a.day_of_week - b.day_of_week ||
      a.lesson_num - b.lesson_num,
  );
  for (const e of sorted) {
    rows.push(
      [
        escCsv(e.class_section),
        String(e.day_of_week),
        String(e.lesson_num),
        escCsv(e.subject),
        escCsv(e.teacher_label ?? ''),
      ].join(';'),
    );
  }
  return rows.join('\n');
}
