import type { PDFPage, PDFFont, RGB } from 'pdf-lib';
import { DAY_LABELS, type ExportEntry } from './ders-dagit.export';
import {
  estimateMasterCellMinHeight,
  fitTwoLineCell,
  masterCellAbbrevLines,
  masterRowDisplayLabel,
} from './ders-dagit-pdf-abbrev';
import { subjectCellStyle } from './ders-dagit-pdf-brand';
import {
  beginCompactSheetPage,
  drawCellText,
  drawPageFooter,
  drawPdfTextBlockCentered,
  paletteFor,
  truncateToWidth,
  type PdfHeaderInfo,
  type PdfPrintTheme,
} from './ders-dagit-pdf-layout';
import { contentBottom, PDF_COMPACT_HEADER_RESERVE } from './ders-dagit-pdf-space';

export type MasterSheetAxis = 'teacher' | 'class' | 'room';

type MasterCell = { line1: string; line2: string; colorKey: string };

export function buildMasterRows(
  entries: ExportEntry[],
  axis: MasterSheetAxis,
): { rowLabels: string[]; cells: Map<string, MasterCell>; workDays: number[]; maxLesson: number } {
  const cells = new Map<string, MasterCell>();
  const rowSet = new Set<string>();
  let maxLesson = 0;
  const daySet = new Set<number>();

  for (const e of entries) {
    daySet.add(e.day_of_week);
    maxLesson = Math.max(maxLesson, e.lesson_num);
    const rowKey =
      axis === 'teacher'
        ? e.teacher_label?.trim() || e.user_id?.slice(0, 8) || '—'
        : axis === 'class'
          ? e.class_section
          : e.room_name?.trim() || '—';
    rowSet.add(rowKey);
    const slot = `${rowKey}|${e.day_of_week}|${e.lesson_num}`;
    const { line1, line2 } = masterCellAbbrevLines(axis, e);
    cells.set(slot, { line1, line2, colorKey: e.subject });
  }

  const workDays = [...daySet].sort((a, b) => a - b);
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const rowLabels = [...rowSet].sort((a, b) => a.localeCompare(b, 'tr'));
  return { rowLabels, cells, workDays: days, maxLesson: Math.max(maxLesson, 1) };
}

const A3_LANDSCAPE: [number, number] = [1191, 842];

export function masterSheetTitle(axis: MasterSheetAxis): string {
  if (axis === 'teacher') return 'Toplu Çarşaf Liste · Öğretmenler';
  if (axis === 'class') return 'Toplu Çarşaf Liste · Sınıflar';
  return 'Toplu Çarşaf Liste · Derslikler';
}

function drawCenteredMini(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font: PDFFont,
  size: number,
  color: RGB,
) {
  const t = truncateToWidth(text, font, size, w - 4);
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: x + (w - tw) / 2, y: y + h * 0.35, size, font, color });
}

function drawMasterLessonCell(
  page: PDFPage,
  cell: MasterCell,
  x: number,
  y: number,
  w: number,
  h: number,
  font: PDFFont,
  pal: ReturnType<typeof paletteFor>,
  colorMode: boolean,
) {
  const outerPad = 2;
  const stripeW = 3;
  const innerPad = 3;
  const boxX = x + outerPad;
  const boxY = y + outerPad;
  const boxW = w - outerPad * 2;
  const boxH = h - outerPad * 2;

  const { fill, stripe } = subjectCellStyle(cell.colorKey, colorMode);
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: fill,
    borderColor: pal.borderLight,
    borderWidth: 0.25,
  });
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: stripeW,
    height: boxH,
    color: stripe,
  });

  const contentX = boxX + stripeW + innerPad;
  const contentY = boxY + innerPad;
  const contentW = boxW - stripeW - innerPad * 2;
  const contentH = boxH - innerPad * 2;

  const fit = fitTwoLineCell(cell.line1, cell.line2, font, contentW, contentH, true);
  const textLines = fit.line2
    ? [
        { text: fit.line1, size: fit.size, color: pal.ink },
        { text: fit.line2, size: fit.size2, color: pal.muted },
      ]
    : [{ text: fit.line1, size: fit.size, color: pal.ink }];

  drawPdfTextBlockCentered(page, contentX, contentY, contentW, contentH, textLines, font);
}

export function drawMasterSheetPage(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  axis: MasterSheetAxis,
  rowLabels: string[],
  cells: Map<string, MasterCell>,
  workDays: number[],
  maxLesson: number,
  theme: PdfPrintTheme,
  pageNum: number,
  pageTotal: number,
  rowH = 36,
) {
  const pal = paletteFor(theme);
  const colorMode = theme === 'color';
  const headerInfo: PdfHeaderInfo = {
    school_name: header.school_name,
    document_title: masterSheetTitle(axis),
    academic_year: header.academic_year,
    subtitle: null,
    program_name: null,
    footer_note: header.footer_note,
  };
  let yTop = beginCompactSheetPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);

  const lessons = maxLesson;
  const slotCount = Math.max(1, workDays.length * lessons);
  const usableW = pageW - 2 * margin - 8;
  const nameColW = Math.min(
    140,
    Math.max(96, ...rowLabels.map((r) => fontBold.widthOfTextAtSize(r.slice(0, 28), 7) + 20)),
  );
  const periodColW = Math.min(62, Math.max(40, Math.floor((usableW - nameColW) / slotCount)));
  const innerCellW = Math.max(12, periodColW - 14);
  let effectiveRowH = rowH;
  for (const rk of rowLabels) {
    for (const day of workDays) {
      for (let les = 1; les <= lessons; les++) {
        const cell = cells.get(`${rk}|${day}|${les}`);
        if (!cell) continue;
        const need = estimateMasterCellMinHeight(cell.line1, cell.line2, font, innerCellW);
        effectiveRowH = Math.max(effectiveRowH, need);
      }
    }
  }
  const bottomY = contentBottom(margin);
  const maxRowHForPage = Math.floor((yTop - bottomY) / Math.max(1, rowLabels.length + 2));
  effectiveRowH = Math.min(40, Math.max(rowH, effectiveRowH), Math.max(20, maxRowHForPage));
  rowH = effectiveRowH;

  const tableW = nameColW + slotCount * periodColW;
  const x0 = margin + Math.max(0, (usableW - tableW) / 2);
  const headerRows = 2;
  const dataRows = rowLabels.length;
  const tableH = (headerRows + dataRows) * rowH;
  const yTableBottom = yTop - tableH;

  page.drawRectangle({
    x: x0,
    y: yTableBottom,
    width: tableW,
    height: tableH,
    color: pal.white,
    borderColor: pal.border,
    borderWidth: 0.8,
  });

  let y = yTop;
  const rowLabel =
    axis === 'teacher' ? 'ÖĞRETMEN' : axis === 'class' ? 'SINIF / ŞUBE' : 'DERSLİK';

  for (let hr = 0; hr < headerRows; hr++) {
    y -= rowH;
    page.drawRectangle({ x: x0, y, width: tableW, height: rowH, color: pal.headerFill });
    if (hr === 0) {
      drawCellText(page, rowLabel, x0 + 4, y + 3, nameColW - 8, rowH - 6, fontBold, 7, pal.headerInk, 2);
      let cx = x0 + nameColW;
      for (const day of workDays) {
        const dayW = lessons * periodColW;
        const label = (DAY_LABELS[day] ?? String(day)).toUpperCase().slice(0, 8);
        drawCellText(page, label, cx, y + 3, dayW, rowH - 6, fontBold, 6.5, pal.headerInk, 1);
        page.drawLine({
          start: { x: cx + dayW, y },
          end: { x: cx + dayW, y: yTop },
          thickness: 0.35,
          color: pal.borderLight,
        });
        cx += dayW;
      }
    } else {
      drawCellText(page, 'Saat', x0 + 4, y + 3, nameColW - 8, rowH - 6, fontBold, 6, pal.headerInk, 1);
      let cx = x0 + nameColW;
      for (const day of workDays) {
        for (let les = 1; les <= lessons; les++) {
          drawCenteredMini(page, String(les), cx, y, periodColW, rowH, fontBold, 6, pal.headerInk);
          cx += periodColW;
        }
      }
    }
    page.drawLine({
      start: { x: x0, y },
      end: { x: x0 + tableW, y },
      thickness: 0.35,
      color: pal.borderLight,
    });
  }

  page.drawLine({
    start: { x: x0 + nameColW, y: yTableBottom },
    end: { x: x0 + nameColW, y: yTop },
    thickness: 0.6,
    color: pal.border,
  });

  for (let ri = 0; ri < dataRows; ri++) {
    y -= rowH;
    const rowKey = rowLabels[ri]!;
    if (ri % 2 === 1) {
      page.drawRectangle({ x: x0, y, width: tableW, height: rowH, color: pal.altRow });
    }
    page.drawLine({
      start: { x: x0, y },
      end: { x: x0 + tableW, y },
      thickness: 0.3,
      color: pal.borderLight,
    });
    page.drawRectangle({
      x: x0 + 3,
      y: y + 3,
      width: nameColW - 6,
      height: rowH - 6,
      color: pal.surfaceRaised,
      borderColor: pal.borderLight,
      borderWidth: 0.3,
    });
    const rowLabel = masterRowDisplayLabel(axis, rowKey);
    drawCellText(page, rowLabel, x0 + 4, y + 3, nameColW - 8, rowH - 6, fontBold, 6.5, pal.primary, 2);

    let cx = x0 + nameColW;
    for (const day of workDays) {
      for (let les = 1; les <= lessons; les++) {
        const slot = `${rowKey}|${day}|${les}`;
        const cell = cells.get(slot);
        if (cell) {
          drawMasterLessonCell(page, cell, cx, y, periodColW, rowH, font, pal, colorMode);
        }
        cx += periodColW;
      }
    }
  }

  drawPageFooter(page, margin, pageW, font, pal, {
    footer_note: header.footer_note,
    pageNum,
    pageTotal,
  });
}

export function paginateMasterRows(rowLabels: string[], perPage: number): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < rowLabels.length; i += perPage) {
    pages.push(rowLabels.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}

export const MASTER_PAGE_SIZE = A3_LANDSCAPE;
export { PDF_COMPACT_HEADER_RESERVE };
