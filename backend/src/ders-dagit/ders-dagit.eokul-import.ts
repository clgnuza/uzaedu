/**
 * Faz 34 — e-Okul içe aktarma (tablo CSV/XLSX + program ızgarası XLS)
 */
import * as XLSX from 'xlsx';
import { splitEokulCell, normalizeClassToken, normalizeWhitespace } from '../teacher-timetable/timetable-reconcile/normalize';
import {
  EOKUL_WEEKDAY_COLUMNS,
  isTeacherBlockBoundary,
  isLessonCellText,
  parseSlotFromTimeColumn,
} from '../teacher-timetable/timetable-reconcile/eokul-xls-grid';

export type EokulAssignmentDraft = {
  subject_name: string;
  class_sections: string[];
  weekly_hours: number;
  teacher_tc: string | null;
  teacher_name: string | null;
};

export type EokulImportWarning = { code: string; message: string };

export type EokulImportPreview = {
  assignments: EokulAssignmentDraft[];
  warnings: EokulImportWarning[];
  format: string;
  row_count: number;
};

function normTc(raw: string): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length === 11 ? d : null;
}

function splitSections(raw: string): string[] {
  return raw
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .map((s) => normalizeClassToken(s) ?? s)
    .filter(Boolean);
}

function bucketKey(subject: string, section: string, tc: string | null, name: string | null): string {
  return `${section}\0${subject}\0${tc ?? ''}\0${name ?? ''}`;
}

function addToBucket(
  map: Map<string, EokulAssignmentDraft & { _count: number }>,
  subject: string,
  section: string,
  hours: number,
  tc: string | null,
  name: string | null,
): void {
  const sub = normalizeWhitespace(subject).slice(0, 128);
  const sec = normalizeClassToken(section) ?? normalizeWhitespace(section);
  if (!sub || !sec) return;
  const k = bucketKey(sub, sec, tc, name);
  const prev = map.get(k);
  if (prev) {
    prev._count += hours;
    prev.weekly_hours = prev._count;
  } else {
    map.set(k, {
      subject_name: sub,
      class_sections: [sec],
      weekly_hours: hours,
      teacher_tc: tc,
      teacher_name: name,
      _count: hours,
    });
  }
}

function finalizeBuckets(map: Map<string, EokulAssignmentDraft & { _count: number }>): EokulAssignmentDraft[] {
  return [...map.values()].map(({ _count: _, ...r }) => ({
    ...r,
    weekly_hours: Math.max(1, Math.min(40, r.weekly_hours)),
  }));
}

/** Noktalı virgül / virgül — Ders;Sinif;Saat veya program satırları */
export function parseEokulCsv(text: string): EokulImportPreview {
  const warnings: EokulImportWarning[] = [];
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) {
    return { assignments: [], warnings: [{ code: 'EMPTY', message: 'Dosya boş.' }], format: 'csv', row_count: 0 };
  }
  const delim = lines[0]!.includes(';') ? ';' : ',';
  const head = lines[0]!.toLowerCase();
  const isSchedule =
    head.includes('derssirasi') || head.includes('gunno') || (head.includes('sinif') && head.includes('dersadi'));
  const map = new Map<string, EokulAssignmentDraft & { _count: number }>();
  let start = 0;
  if (/ders|sinif|subject|okul/i.test(lines[0]!)) start = 1;

  for (const line of lines.slice(start)) {
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (isSchedule && cols.length >= 4) {
      const section = cols[1] ?? cols[0] ?? '';
      const subject = cols[3] ?? cols[2] ?? '';
      const tc = normTc(cols[5] ?? cols[4] ?? '');
      const name = cols[4] && !tc ? cols[4] : null;
      addToBucket(map, subject, section, 1, tc, name);
      continue;
    }
    if (cols.length < 3) continue;
    const subject = cols[0] ?? '';
    const sections = cols[1] ?? '';
    const hours = Math.max(1, Number(cols[2]) || 1);
    const tc = normTc(cols[3] ?? '');
    const name = cols[4] ?? null;
    for (const sec of splitSections(sections)) {
      addToBucket(map, subject, sec, hours, tc, name);
    }
  }

  if (!map.size) warnings.push({ code: 'NO_ROWS', message: 'Okunabilir satır bulunamadı. Sütunlar: Ders, Sinif, Saat' });
  return {
    assignments: finalizeBuckets(map),
    warnings,
    format: isSchedule ? 'schedule_csv' : 'csv',
    row_count: lines.length - start,
  };
}

function pickSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  const name = wb.SheetNames.find((n) => !/kılavuz|kilavuz|guide/i.test(n)) ?? wb.SheetNames[0];
  return name ? wb.Sheets[name]! : null;
}

/** Excel tablo: Ders, Sinif, Saat, OgretmenTc, OgretmenAdi */
export function parseEokulTableXlsx(buffer: Buffer): EokulImportPreview {
  const warnings: EokulImportWarning[] = [];
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = pickSheet(wb);
  if (!sheet) {
    return { assignments: [], warnings: [{ code: 'NO_SHEET', message: 'Sayfa yok.' }], format: 'xlsx', row_count: 0 };
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const map = new Map<string, EokulAssignmentDraft & { _count: number }>();
  for (const row of rows) {
    const keys = Object.keys(row);
    const pick = (...names: string[]) => {
      for (const n of names) {
        const k = keys.find((x) => x.toLowerCase().replace(/\s/g, '') === n.toLowerCase().replace(/\s/g, ''));
        if (k != null && row[k] != null && String(row[k]).trim()) return String(row[k]).trim();
      }
      return '';
    };
    const subject = pick('Ders', 'DersAdi', 'ders', 'subject');
    const sections = pick('Sinif', 'Sınıf', 'sinif', 'class', 'Sube');
    const hours = Math.max(1, Number(pick('Saat', 'HaftalikSaat', 'hours') || 1) || 1);
    const tc = normTc(pick('OgretmenTc', 'TC', 'TCKN', 'tc_kimlik'));
    const name = pick('OgretmenAdi', 'Ogretmen', 'teacher_name');
    if (!subject || !sections) continue;
    for (const sec of splitSections(sections)) {
      addToBucket(map, subject, sec, hours, tc, name || null);
    }
  }
  if (!map.size) {
    warnings.push({
      code: 'NO_ROWS',
      message: 'Sütun başlıkları: Ders, Sinif, Saat (isteğe OgretmenTc / OgretmenAdi).',
    });
  }
  return {
    assignments: finalizeBuckets(map),
    warnings,
    format: 'xlsx',
    row_count: rows.length,
  };
}

function readCellText(sheet: XLSX.WorkSheet, merges: XLSX.Range[], ri: number, ci: number): string {
  const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
  let cell = sheet[addr] as XLSX.CellObject | undefined;
  if (!cell || ((cell.v === '' || cell.v == null) && !cell.w)) {
    for (const m of merges) {
      if (ri >= m.s.r && ri <= m.e.r && ci >= m.s.c && ci <= m.e.c) {
        const master = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
        cell = sheet[master] as XLSX.CellObject | undefined;
        break;
      }
    }
  }
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim()) return normalizeWhitespace(String(cell.w));
  if (cell.v == null) return '';
  return normalizeWhitespace(String(cell.v));
}

/** e-Okul öğretmen programı XLS/XLSX ızgarası → sınıf+ders saat sayımı */
export function parseEokulGridXlsx(buffer: Buffer): EokulImportPreview {
  const warnings: EokulImportWarning[] = [];
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((n) => !/kılavuz|kilavuz|guide/i.test(n)) ?? wb.SheetNames[0]!;
  const sheet = wb.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    return { assignments: [], warnings: [{ code: 'NO_SHEET', message: 'Sayfa yok.' }], format: 'grid_xlsx', row_count: 0 };
  }
  const merges = (sheet['!merges'] ?? []) as XLSX.Range[];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const map = new Map<string, EokulAssignmentDraft & { _count: number }>();
  let currentSlot: number | null = null;
  let teacherName: string | null = null;
  let cellCount = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!Array.isArray(row)) continue;
    const col0 = readCellText(sheet, merges, ri, 0) || normalizeWhitespace(String(row[0] ?? ''));

    if (isTeacherBlockBoundary(col0)) {
      teacherName = null;
      currentSlot = null;
      continue;
    }

    const parsed = parseSlotFromTimeColumn(col0);
    if (parsed.slot != null) {
      currentSlot = parsed.slot;
      continue;
    }

    if (col0.length > 4 && col0.length < 80 && !/\d{1,2}:\d{2}/.test(col0) && !/DERS/i.test(col0)) {
      if (/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s.]{3,}$/u.test(col0)) {
        teacherName = col0.slice(0, 64);
      }
    }

    if (currentSlot == null) continue;

    for (const dc of EOKUL_WEEKDAY_COLUMNS) {
      const raw = readCellText(sheet, merges, ri, dc.col);
      if (!isLessonCellText(raw)) continue;
      cellCount++;
      const pairs = splitEokulCell(raw);
      for (const p of pairs) {
        addToBucket(map, p.subject, p.class_section, 1, null, teacherName);
      }
    }
  }

  if (!map.size) {
    warnings.push({ code: 'NO_LESSONS', message: 'Izgarada ders hücresi bulunamadı.' });
  } else if (cellCount > 0) {
    const noTeacher = [...map.values()].filter((v) => !v.teacher_name).length;
    if (noTeacher > map.size * 0.5) {
      warnings.push({
        code: 'TEACHER_GUESS',
        message:
          'Çoğu satırda öğretmen adı çıkarılamadı. Tablo XLSX (Ders/Sinif/Saat/OgretmenTc) daha güvenilirdir.',
      });
    }
  }

  return {
    assignments: finalizeBuckets(map),
    warnings,
    format: 'grid_xlsx',
    row_count: cellCount,
  };
}

export function parseEokulImport(input: {
  csv?: string;
  buffer?: Buffer;
  format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
}): EokulImportPreview {
  const fmt = input.format ?? 'auto';
  if (input.csv?.trim()) return parseEokulCsv(input.csv);
  if (!input.buffer?.length) {
    return {
      assignments: [],
      warnings: [{ code: 'EMPTY', message: 'Dosya içeriği yok.' }],
      format: 'unknown',
      row_count: 0,
    };
  }
  if (fmt === 'csv') return parseEokulCsv(input.buffer.toString('utf8'));
  if (fmt === 'grid_xlsx') return parseEokulGridXlsx(input.buffer);
  if (fmt === 'xlsx') return parseEokulTableXlsx(input.buffer);
  const table = parseEokulTableXlsx(input.buffer);
  if (table.assignments.length > 0) return table;
  return parseEokulGridXlsx(input.buffer);
}

export function buildEokulImportTemplateXlsx(): Buffer {
  const ws = XLSX.utils.json_to_sheet([
    {
      Ders: 'Matematik',
      Sinif: '9A',
      Saat: 4,
      OgretmenTc: '',
      OgretmenAdi: 'Örnek Öğretmen',
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'e-Okul-Atama');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
