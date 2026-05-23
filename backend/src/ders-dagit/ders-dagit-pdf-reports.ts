import type { PDFDocument, PDFPage, PDFFont } from 'pdf-lib';
import { DAY_LABELS } from './ders-dagit.export';
import type { BrandPalette } from './ders-dagit-pdf-brand';
import {
  beginCompactSheetPage,
  drawCellText,
  drawCenteredText,
  drawPageFooter,
  paletteFor,
  type PdfHeaderInfo,
  type PdfPrintTheme,
} from './ders-dagit-pdf-layout';
import { contentBottom, fitScheduleRowHeight } from './ders-dagit-pdf-space';

export type DutySlotRow = {
  user_id: string;
  teacher_label: string;
  date: string;
  day_of_week: number;
  lesson_num: number | null;
  shift: string;
  area_name: string | null;
  slot_name: string | null;
};

export type DualClassRow = {
  class_section: string;
  shift_label: string;
  placed_hours: number;
  morning_hours: number;
  afternoon_hours: number;
};

export type ExtraLessonRow = {
  label: string;
  branch: string | null;
  mandatory: number | null;
  max_extra: number | null;
  actual: number;
  diff: number;
  extra_available: number | null;
};

function dayFromIso(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function aggregateDutySlots(slots: DutySlotRow[], workDays: number[]): {
  teachers: string[];
  cells: Map<string, string>;
} {
  const byTeacher = new Map<string, string>();
  const cells = new Map<string, string>();

  for (const s of slots) {
    const dow = s.day_of_week || dayFromIso(s.date);
    if (!workDays.includes(dow)) continue;
    const key = `${s.teacher_label}|${dow}`;
    const part = s.lesson_num
      ? `${s.lesson_num}.s ${(s.area_name ?? s.slot_name ?? '').slice(0, 12)}`.trim()
      : (s.area_name ?? s.slot_name ?? 'Nöbet').slice(0, 16);
    const prev = cells.get(key);
    cells.set(key, prev ? `${prev}\n${part}` : part);
    byTeacher.set(s.teacher_label, s.teacher_label);
  }

  return { teachers: [...byTeacher.keys()].sort((a, b) => a.localeCompare(b, 'tr')), cells };
}

export async function buildDutyReportPdf(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  slots: DutySlotRow[],
  workDays: number[],
  theme: PdfPrintTheme,
): Promise<void> {
  const pageW = 842;
  const pageH = 595;
  const margin = 48;
  const bottomY = contentBottom(margin);
  const pal = paletteFor(theme);
  const { teachers, cells } = aggregateDutySlots(slots, workDays);

  const page = doc.addPage([pageW, pageH]);
  const headerInfo: PdfHeaderInfo = {
    school_name: header.school_name,
    document_title: 'Haftalık Nöbet Çizelgesi',
    academic_year: header.academic_year,
    footer_note: header.footer_note,
  };
  let yTop = beginCompactSheetPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);

  if (!teachers.length) {
    drawCenteredText(
      page,
      'Yayınlı nöbet kaydı bulunamadı. Nöbet modülünde plan yayınlayın.',
      margin,
      pageH / 2,
      pageW - 2 * margin,
      font,
      10,
      pal.muted,
    );
    drawPageFooter(page, margin, pageW, font, pal, { footer_note: header.footer_note });
    return;
  }

  const nameColW = 120;
  const colW = (pageW - 2 * margin - nameColW - 8) / workDays.length;
  const rowH = fitScheduleRowHeight(yTop, bottomY, teachers.length, 22);
  const tableH = rowH * (teachers.length + 1);
  const x0 = margin + 4;
  const yBottom = yTop - tableH;

  page.drawRectangle({
    x: x0,
    y: yBottom,
    width: nameColW + workDays.length * colW,
    height: tableH,
    color: pal.white,
    borderColor: pal.border,
    borderWidth: 0.8,
  });

  const headY = yTop - rowH;
  page.drawRectangle({
    x: x0,
    y: headY,
    width: nameColW + workDays.length * colW,
    height: rowH,
    color: pal.headerFill,
  });
  drawCellText(page, 'ÖĞRETMEN', x0 + 4, headY + 3, nameColW - 8, rowH - 6, fontBold, 7.5, pal.headerInk, 1);
  workDays.forEach((d, i) => {
    const dx = x0 + nameColW + i * colW;
    drawCellText(
      page,
      (DAY_LABELS[d] ?? String(d)).toUpperCase().slice(0, 9),
      dx + 2,
      headY + 3,
      colW - 4,
      rowH - 6,
      fontBold,
      7,
      pal.headerInk,
      1,
    );
  });

  let y = headY;
  for (let ri = 0; ri < teachers.length; ri++) {
    y -= rowH;
    const teacher = teachers[ri]!;
    if (ri % 2 === 1) {
      page.drawRectangle({
        x: x0,
        y,
        width: nameColW + workDays.length * colW,
        height: rowH,
        color: pal.altRow,
      });
    }
    drawCellText(page, teacher.slice(0, 24), x0 + 4, y + 3, nameColW - 8, rowH - 6, fontBold, 6.5, pal.primary, 2);
    workDays.forEach((d, di) => {
      const dx = x0 + nameColW + di * colW;
      const txt = cells.get(`${teacher}|${d}`) ?? '·';
      drawCellText(page, txt, dx + 2, y + 2, colW - 4, rowH - 4, font, 6, pal.ink, 2);
    });
  }

  drawPageFooter(page, margin, pageW, font, pal, { footer_note: header.footer_note });
}

function drawDataTable(
  page: PDFPage,
  x: number,
  yTop: number,
  tableW: number,
  headers: string[],
  colWidths: number[],
  rows: string[][],
  rowH: number,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
) {
  const tableH = rowH * (rows.length + 1);
  const yBottom = yTop - tableH;
  page.drawRectangle({
    x,
    y: yBottom,
    width: tableW,
    height: tableH,
    borderColor: pal.border,
    borderWidth: 0.7,
  });
  let cx = x;
  const headY = yTop - rowH;
  page.drawRectangle({ x, y: headY, width: tableW, height: rowH, color: pal.headerFill });
  for (let i = 0; i < headers.length; i++) {
    drawCellText(page, headers[i]!, cx + 4, headY + 4, colWidths[i]! - 8, rowH - 8, fontBold, 7, pal.headerInk, 1);
    cx += colWidths[i]!;
  }
  let y = headY;
  for (let ri = 0; ri < rows.length; ri++) {
    y -= rowH;
    if (ri % 2 === 1) {
      page.drawRectangle({ x, y, width: tableW, height: rowH, color: pal.altRow });
    }
    cx = x;
    for (let ci = 0; ci < rows[ri]!.length; ci++) {
      drawCellText(page, rows[ri]![ci] ?? '', cx + 4, y + 4, colWidths[ci]! - 8, rowH - 8, font, 7, pal.ink, 2);
      cx += colWidths[ci]!;
    }
  }
  return yBottom;
}

export async function buildDualEducationPdf(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  rows: DualClassRow[],
  dualEnabled: boolean,
  pmFirst: number,
  theme: PdfPrintTheme,
): Promise<void> {
  const pageW = 595;
  const pageH = 842;
  const margin = 48;
  const pal = paletteFor(theme);
  const page = doc.addPage([pageW, pageH]);
  const headerInfo: PdfHeaderInfo = {
    school_name: header.school_name,
    document_title: 'İkili Eğitim Program Tablosu',
    academic_year: header.academic_year,
    subtitle: dualEnabled ? `Öğle vardiyası ${pmFirst}. saatten başlar` : 'İkili eğitim kapalı',
    footer_note: header.footer_note,
  };
  let yTop = beginCompactSheetPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
  const bottomY = contentBottom(margin);

  if (!dualEnabled) {
    drawCenteredText(
      page,
      'Stüdyo ayarlarında ikili eğitim etkin değil.',
      margin,
      pageH / 2,
      pageW - 2 * margin,
      font,
      10,
      pal.muted,
    );
    drawPageFooter(page, margin, pageW, font, pal, {});
    return;
  }

  const tableW = pageW - 2 * margin - 8;
  const cols = [tableW * 0.22, tableW * 0.18, tableW * 0.16, tableW * 0.16, tableW * 0.28];
  const dataRows = rows.map((r) => [
    r.class_section,
    r.shift_label,
    String(r.placed_hours),
    `${r.morning_hours} / ${r.afternoon_hours}`,
    'Sabah·Öğle dağılımı',
  ]);
  const rowH = fitScheduleRowHeight(yTop, bottomY, Math.min(rows.length, 20), 22);
  drawDataTable(
    page,
    margin + 4,
    yTop,
    tableW,
    ['Şube', 'Vardiya', 'Toplam saat', 'S / Ö', 'Not'],
    cols,
    dataRows.slice(0, 35),
    rowH,
    font,
    fontBold,
    pal,
  );
  drawPageFooter(page, margin, pageW, font, pal, { footer_note: header.footer_note });
}

export async function buildExtraLessonPdf(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  rows: ExtraLessonRow[],
  programName: string,
  theme: PdfPrintTheme,
): Promise<void> {
  const pageW = 842;
  const pageH = 595;
  const margin = 48;
  const pal = paletteFor(theme);
  let page = doc.addPage([pageW, pageH]);
  const headerInfo: PdfHeaderInfo = {
    school_name: header.school_name,
    document_title: 'Ek Ders / Maaş Karşılığı Özeti',
    academic_year: header.academic_year,
    subtitle: programName,
    footer_note: header.footer_note,
  };
  let yTop = beginCompactSheetPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
  const bottomY = contentBottom(margin);
  const tableW = pageW - 2 * margin - 8;
  const cols = [tableW * 0.26, tableW * 0.12, tableW * 0.12, tableW * 0.12, tableW * 0.1, tableW * 0.14, tableW * 0.14];
  const headers = ['Öğretmen', 'Branş', 'Norm', 'Gerçek', 'Fark', 'Ek kap.', 'Durum'];

  const chunk = 22;
  for (let off = 0; off < rows.length; off += chunk) {
    if (off > 0) {
      page = doc.addPage([pageW, pageH]);
      yTop = beginCompactSheetPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
    }
    const slice = rows.slice(off, off + chunk);
    const dataRows = slice.map((r) => {
      const status =
        r.mandatory != null && r.actual > r.mandatory + (r.max_extra ?? 0)
          ? 'Limit üstü'
          : r.actual > (r.mandatory ?? 0)
            ? 'Ek ders var'
            : r.actual < (r.mandatory ?? 0)
              ? 'Eksik'
              : 'Tamam';
      return [
        r.label,
        r.branch ?? '—',
        r.mandatory != null ? String(r.mandatory) : '—',
        String(r.actual),
        r.diff >= 0 ? `+${r.diff}` : String(r.diff),
        r.extra_available != null ? String(r.extra_available) : '—',
        status,
      ];
    });
    const rowH = fitScheduleRowHeight(yTop, bottomY, slice.length, 20);
    drawDataTable(page, margin + 4, yTop, tableW, headers, cols, dataRows, rowH, font, fontBold, pal);
    drawPageFooter(page, margin, pageW, font, pal, {
      footer_note: header.footer_note,
      pageNum: Math.floor(off / chunk) + 1,
      pageTotal: Math.ceil(rows.length / chunk) || 1,
    });
  }
}
