/**
 * Faz 35 — e-Okul dışa aktarım + doğrulama raporu
 */
import { compareClassSections } from './class-section-sort';
import type { ExportEntry } from './ders-dagit.export';
import { DAY_LABELS, escCsv } from './ders-dagit.export';
import { classSlotKey } from './ders-dagit.program-clash';

export type EokulExportRow = ExportEntry & {
  teacher_tc?: string | null;
  teacher_id?: string | null;
};

export type EokulExportIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  row?: number;
  class_section?: string;
};

export type EokulExportReport = {
  ok: boolean;
  entry_count: number;
  error_count: number;
  warning_count: number;
  issues: EokulExportIssue[];
};

export function validateEokulExport(rows: EokulExportRow[]): EokulExportReport {
  const issues: EokulExportIssue[] = [];
  const classSlot = new Map<string, string>();
  const teacherSlot = new Map<string, string>();

  rows.forEach((e, idx) => {
    const rowNum = idx + 2;
    if (!e.class_section?.trim()) {
      issues.push({
        code: 'MISSING_CLASS',
        severity: 'error',
        message: 'Sınıf/şube boş',
        row: rowNum,
      });
    }
    if (!e.subject?.trim()) {
      issues.push({
        code: 'MISSING_SUBJECT',
        severity: 'error',
        message: 'Ders adı boş',
        row: rowNum,
        class_section: e.class_section,
      });
    }
    if (!e.teacher_label && !e.user_id) {
      issues.push({
        code: 'MISSING_TEACHER',
        severity: 'warning',
        message: `${e.class_section} ${e.subject}: öğretmen atanmamış`,
        row: rowNum,
        class_section: e.class_section,
      });
    }
    if (!e.teacher_tc && e.user_id) {
      issues.push({
        code: 'MISSING_TC',
        severity: 'warning',
        message: `${e.teacher_label ?? e.user_id?.slice(0, 8)}: TC yok (e-Okul eşleşmesi zayıf)`,
        row: rowNum,
      });
    }
    const ck = classSlotKey(e.class_section, e.day_of_week, e.lesson_num);
    const prev = classSlot.get(ck);
    if (prev) {
      issues.push({
        code: 'CLASS_CLASH',
        severity: 'error',
        message: `${e.class_section} ${DAY_LABELS[e.day_of_week] ?? e.day_of_week} ders ${e.lesson_num}: çakışma (${prev} / ${e.subject})`,
        row: rowNum,
        class_section: e.class_section,
      });
    } else {
      classSlot.set(ck, e.subject);
    }
    if (e.user_id) {
      const tk = `${e.user_id}\0${e.day_of_week}\0${e.lesson_num}`;
      const tp = teacherSlot.get(tk);
      if (tp) {
        issues.push({
          code: 'TEACHER_CLASH',
          severity: 'error',
          message: `Öğretmen ${e.teacher_label ?? ''} aynı slotta: ${tp} ve ${e.class_section}/${e.subject}`,
          row: rowNum,
        });
      } else {
        teacherSlot.set(tk, `${e.class_section}/${e.subject}`);
      }
    }
  });

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return {
    ok: errors === 0,
    entry_count: rows.length,
    error_count: errors,
    warning_count: warnings,
    issues,
  };
}

const EOKUL_HEADERS = [
  'OkulKodu',
  'Sinif',
  'GunNo',
  'GunAdi',
  'DersSirasi',
  'DersAdi',
  'OgretmenAdi',
  'OgretmenTc',
  'OgretmenId',
  'Derslik',
  'HaftalikSaat',
  'Durum',
] as const;

export function buildEokulScheduleCsv(
  rows: EokulExportRow[],
  opts?: { school_code?: string; report?: EokulExportReport },
): string {
  const hourByClassSubject = new Map<string, number>();
  for (const e of rows) {
    const k = `${e.class_section}\0${e.subject}`;
    hourByClassSubject.set(k, (hourByClassSubject.get(k) ?? 0) + 1);
  }
  const issueByRow = new Map<number, string>();
  if (opts?.report) {
    for (const i of opts.report.issues) {
      if (i.row != null) issueByRow.set(i.row, i.severity === 'error' ? 'HATA' : 'UYARI');
    }
  }
  const out = [EOKUL_HEADERS.join(';')];
  const sorted = [...rows].sort(
    (a, b) =>
      compareClassSections(a.class_section, b.class_section) ||
      a.day_of_week - b.day_of_week ||
      a.lesson_num - b.lesson_num,
  );
  sorted.forEach((e, idx) => {
    const rowNum = idx + 2;
    const weekly = hourByClassSubject.get(`${e.class_section}\0${e.subject}`) ?? 0;
    const status = issueByRow.get(rowNum) ?? (e.teacher_label || e.user_id ? 'OK' : 'OGRETMEN_YOK');
    out.push(
      [
        escCsv(opts?.school_code ?? ''),
        escCsv(e.class_section),
        String(e.day_of_week),
        escCsv(DAY_LABELS[e.day_of_week] ?? ''),
        String(e.lesson_num),
        escCsv(e.subject),
        escCsv(e.teacher_label ?? ''),
        escCsv(e.teacher_tc ?? ''),
        escCsv(e.teacher_id ?? e.user_id ?? ''),
        escCsv(e.room_name ?? ''),
        String(weekly),
        status,
      ].join(';'),
    );
  });
  return out.join('\n');
}

export function buildEokulScheduleXlsx(
  rows: EokulExportRow[],
  opts?: { school_code?: string; report?: EokulExportReport },
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const csv = buildEokulScheduleCsv(rows, opts);
  const lines = csv.split(/\r?\n/);
  const headers = lines[0]!.split(';');
  const data = lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(';').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? '';
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'e-Okul-Program');
  if (opts?.report && opts.report.issues.length) {
    const rep = opts.report.issues.map((i) => ({
      Kod: i.code,
      Seviye: i.severity,
      Mesaj: i.message,
      Satir: i.row ?? '',
      Sinif: i.class_section ?? '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rep), 'Dogrulama');
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function buildEokulReportCsv(report: EokulExportReport): string {
  const rows = ['Kod;Seviye;Mesaj;Satir;Sinif'];
  for (const i of report.issues) {
    rows.push(
      [i.code, i.severity, escCsv(i.message), i.row != null ? String(i.row) : '', escCsv(i.class_section ?? '')].join(
        ';',
      ),
    );
  }
  rows.push('');
  rows.push(`Toplam satir;${report.entry_count}`);
  rows.push(`Hata;${report.error_count}`);
  rows.push(`Uyari;${report.warning_count}`);
  rows.push(`e-Okul hazir;${report.ok ? 'EVET' : 'HAYIR'}`);
  return rows.join('\n');
}
