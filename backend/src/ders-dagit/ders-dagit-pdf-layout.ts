import type { PDFPage, PDFFont, RGB } from 'pdf-lib';
import { DAY_LABELS } from './ders-dagit.export';
import { estimateScheduleCellMinHeight, fitScheduleCellLines } from './ders-dagit-pdf-abbrev';
import { fitScheduleRowHeight } from './ders-dagit-pdf-space';
import {
  brandPalette,
  drawBrandWatermark,
  drawMetaChips,
  drawPageChrome,
  drawTitleBadge,
  subjectCellStyle,
  type BrandPalette,
} from './ders-dagit-pdf-brand';

export type PdfPrintTheme = 'color' | 'bw';

export function parsePdfTheme(raw?: string | null): PdfPrintTheme {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'bw' || t === 'siyah' || t === '0' || t === 'false') return 'bw';
  return 'color';
}

export type PdfHeaderInfo = {
  school_name: string;
  document_title: string;
  subtitle?: string | null;
  academic_year?: string | null;
  class_section?: string | null;
  program_name?: string | null;
  footer_note?: string | null;
};

/** @deprecated use BrandPalette — kept for compat */
export type PdfPalette = BrandPalette;

export function paletteFor(theme: PdfPrintTheme): BrandPalette {
  return brandPalette(theme === 'color');
}

export function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = text.trim();
  if (!t || maxWidth <= 4) return '';
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = truncateToWidth(w, font, size, maxWidth);
    if (lines.length >= maxLines - 1) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [''];
}

export type PdfTextLine = {
  text: string;
  size: number;
  color: RGB;
  font?: PDFFont;
};

const PDF_TEXT_LINE_GAP = 2;

export function measurePdfTextBlock(
  lines: Array<{ text: string; size: number; font: PDFFont }>,
  lineGap = PDF_TEXT_LINE_GAP,
): number {
  if (!lines.length) return 0;
  let h = 0;
  for (let i = 0; i < lines.length; i++) {
    h += lines[i]!.font.heightAtSize(lines[i]!.size);
    if (i < lines.length - 1) h += lineGap;
  }
  return h;
}

/** Dikdörtgen içinde yatay + dikey ortalı metin (y = alt kenar, pdf-lib font metrikleri) */
export function drawPdfTextBlockCentered(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: PdfTextLine[],
  defaultFont: PDFFont,
  lineGap = PDF_TEXT_LINE_GAP,
): void {
  if (!lines.length || h <= 2 || w <= 4) return;

  const padX = 3;
  const innerW = Math.max(8, w - padX * 2);
  const prepared = lines
    .map((l) => {
      const f = l.font ?? defaultFont;
      const t = truncateToWidth(l.text.trim(), f, l.size, innerW);
      return { text: t, size: l.size, color: l.color, font: f, lineH: f.heightAtSize(l.size) };
    })
    .filter((l) => l.text);

  if (!prepared.length) return;

  const blockH = measurePdfTextBlock(
    prepared.map((p) => ({ text: p.text, size: p.size, font: p.font })),
    lineGap,
  );
  const blockBottom = y + Math.max(0, (h - blockH) / 2);
  const descRatio = 0.24;
  let cy = blockBottom + prepared[prepared.length - 1]!.size * descRatio;

  for (let i = prepared.length - 1; i >= 0; i--) {
    const line = prepared[i]!;
    const tw = line.font.widthOfTextAtSize(line.text, line.size);
    page.drawText(line.text, {
      x: x + padX + Math.max(0, (innerW - tw) / 2),
      y: cy,
      size: line.size,
      font: line.font,
      color: line.color,
    });
    if (i > 0) cy += prepared[i - 1]!.lineH + lineGap;
  }
}

export function drawCenteredText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  w: number,
  font: PDFFont,
  size: number,
  color: RGB,
) {
  const t = truncateToWidth(text, font, size, Math.max(8, w - 6));
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: x + Math.max(2, (w - tw) / 2), y, size, font, color });
}

export function drawCellText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font: PDFFont,
  size: number,
  color: RGB,
  maxLines = 3,
) {
  const innerW = Math.max(8, w - 8);
  let useSize = size;
  let lines: string[] = [];
  for (const trySize of [size, size - 0.5, size - 1, size - 1.5, 5]) {
    if (trySize < 4.5) break;
    const raw = text.split('\n').flatMap((part) => wrapText(part, font, trySize, innerW, maxLines));
    const candidate = raw.slice(0, maxLines);
    const blockH = measurePdfTextBlock(
      candidate.map((ln) => ({ text: ln, size: trySize, font })),
      PDF_TEXT_LINE_GAP,
    );
    if (blockH + 4 <= h || trySize <= 5) {
      useSize = trySize;
      lines = candidate;
      break;
    }
  }
  if (!lines.length) lines = [''];
  drawPdfTextBlockCentered(
    page,
    x,
    y,
    w,
    h,
    lines.map((ln) => ({ text: ln, size: useSize, color })),
    font,
  );
}

function headerMetaChips(header: PdfHeaderInfo): string[] {
  const chips: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const t = raw?.trim();
    if (!t) return;
    const key = t.toLocaleLowerCase('tr');
    if (seen.has(key)) return;
    seen.add(key);
    chips.push(t);
  };
  if (header.class_section) add(`${header.class_section} Şubesi`);
  add(header.academic_year);
  const sub = header.subtitle?.trim();
  const prog = header.program_name?.trim();
  if (sub && sub !== prog) add(sub);
  else if (prog && !header.class_section) add(prog);
  else if (sub) add(sub);
  return chips;
}

export function drawOfficialHeader(
  page: PDFPage,
  pageW: number,
  topY: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  pal: BrandPalette,
): number {
  const cx = pageW / 2;
  let y = topY;

  const tc = 'T.C.';
  const tcSize = 8;
  const tcW = fontBold.widthOfTextAtSize(tc, tcSize);
  page.drawText(tc, { x: cx - tcW / 2, y, size: tcSize, font: fontBold, color: pal.primaryDark });
  y -= 11;

  const meb = 'MİLLÎ EĞİTİM BAKANLIĞI';
  const mebSize = 6.5;
  const mebW = font.widthOfTextAtSize(meb, mebSize);
  page.drawText(meb, { x: cx - mebW / 2, y, size: mebSize, font, color: pal.muted });
  y -= 12;

  const school = truncateToWidth(header.school_name, fontBold, 14, pageW - 2 * margin - 24);
  const schoolSize = school.length > 42 ? 12 : 14;
  const schoolW = fontBold.widthOfTextAtSize(school, schoolSize);
  page.drawText(school, { x: cx - schoolW / 2, y, size: schoolSize, font: fontBold, color: pal.primaryDark });
  y -= schoolSize + 5;

  y = drawTitleBadge(page, cx, y, header.document_title, fontBold, pal, pageW - 2 * margin - 32);

  const chips = headerMetaChips(header);
  if (chips.length) {
    y = drawMetaChips(page, cx, y, chips, font, pal, pageW - 2 * margin - 16);
  }

  page.drawLine({
    start: { x: margin, y: y - 2 },
    end: { x: pageW - margin, y: y - 2 },
    thickness: 0.45,
    color: pal.borderLight,
  });
  return y - 10;
}

export type ScheduleCell = { lines: string[] };

export function buildScheduleGrid(
  entries: Array<{ day_of_week: number; lesson_num: number; lines: string[] }>,
  workDays: number[] = [1, 2, 3, 4, 5],
  maxLesson = 8,
): { days: number[]; lessons: number[]; cells: Map<string, ScheduleCell> } {
  let maxL = 0;
  const cells = new Map<string, ScheduleCell>();
  for (const e of entries) {
    maxL = Math.max(maxL, e.lesson_num);
    const key = `${e.day_of_week}-${e.lesson_num}`;
    const prev = cells.get(key);
    const merged = prev ? { lines: [...prev.lines, ...e.lines] } : { lines: [...e.lines] };
    cells.set(key, merged);
  }
  const lessons: number[] = [];
  const cap = Math.max(maxLesson, maxL, 1);
  for (let i = 1; i <= cap; i++) lessons.push(i);
  return { days: workDays, lessons, cells };
}

function drawLessonCell(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  font: PDFFont,
  pal: BrandPalette,
  colorMode: boolean,
  emptyLabel: string,
) {
  const isEmpty = !text || text === emptyLabel;
  if (isEmpty) {
    page.drawRectangle({ x: x + 1, y: y + 1, width: w - 2, height: h - 2, color: pal.emptyCell });
    drawCenteredText(page, '·', x, y, w, font, 10, pal.borderLight);
    return;
  }
  const subject = text.split('\n')[0] ?? text;
  const { fill, stripe } = subjectCellStyle(subject, colorMode);
  const pad = 2;
  const stripeW = 3;
  page.drawRectangle({ x: x + pad, y: y + pad, width: w - pad * 2, height: h - pad * 2, color: fill });
  page.drawRectangle({ x: x + pad, y: y + pad, width: stripeW, height: h - pad * 2, color: stripe });
  const cx = x + pad + stripeW + 2;
  const cy = y + pad + 2;
  const cw = w - pad * 2 - stripeW - 4;
  const ch = h - pad * 2 - 4;
  const parts = text.split('\n').map((p) => p.trim()).filter(Boolean);
  const fitted = fitScheduleCellLines(parts, font, cw, ch);
  drawPdfTextBlockCentered(
    page,
    cx,
    cy,
    cw,
    ch,
    fitted.map((l) => ({ text: l.text, size: l.size, color: pal.ink })),
    font,
  );
}

export function resolveScheduleRowHeight(
  topY: number,
  bottomY: number,
  lessonCount: number,
  days: number[],
  lessons: number[],
  cells: Map<string, ScheduleCell>,
  colW: number,
  font: PDFFont,
  prefer = 34,
): number {
  let need = 22;
  const innerW = Math.max(20, colW - 14);
  for (const les of lessons) {
    for (const day of days) {
      const lines = cells.get(`${day}-${les}`)?.lines.filter(Boolean) ?? [];
      if (!lines.length) continue;
      need = Math.max(need, estimateScheduleCellMinHeight(lines, font, innerW));
    }
  }
  const cap = Math.floor((topY - bottomY) / Math.max(1, lessonCount + 1));
  const fitted = fitScheduleRowHeight(topY, bottomY, lessonCount, prefer);
  return Math.min(cap, Math.max(fitted, need));
}

export function drawScheduleTable(
  page: PDFPage,
  x: number,
  yTop: number,
  tableW: number,
  hourColW: number,
  rowH: number,
  days: number[],
  lessons: number[],
  cells: Map<string, ScheduleCell>,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
  emptyLabel = '—',
  colorMode = true,
): number {
  const colW = (tableW - hourColW) / days.length;
  const tableH = rowH * (lessons.length + 1);
  const yBottom = yTop - tableH;

  page.drawRectangle({
    x,
    y: yBottom,
    width: tableW,
    height: tableH,
    color: pal.white,
    borderColor: pal.border,
    borderWidth: 0.8,
  });

  const headerY = yTop - rowH;
  page.drawRectangle({ x, y: headerY, width: tableW, height: rowH, color: pal.headerFill });
  drawCenteredText(page, 'SAAT', x, headerY + rowH * 0.34, hourColW, fontBold, 8, pal.headerInk);

  for (let di = 0; di < days.length; di++) {
    const dx = x + hourColW + di * colW;
    if (di > 0) {
      page.drawLine({
        start: { x: dx, y: yBottom },
        end: { x: dx, y: yTop },
        thickness: 0.35,
        color: pal.borderLight,
      });
    }
    const label = (DAY_LABELS[days[di]!] ?? String(days[di])).toUpperCase().slice(0, 10);
    drawCenteredText(page, label, dx, headerY + rowH * 0.34, colW, fontBold, 7.5, pal.headerInk);
  }

  page.drawLine({
    start: { x: x + hourColW, y: yBottom },
    end: { x: x + hourColW, y: yTop },
    thickness: 0.6,
    color: pal.border,
  });

  for (let li = 0; li < lessons.length; li++) {
    const les = lessons[li]!;
    const rowY = yTop - rowH * (li + 2);
    if (li % 2 === 1) {
      page.drawRectangle({ x, y: rowY, width: tableW, height: rowH, color: pal.altRow });
    }
    page.drawLine({
      start: { x, y: rowY },
      end: { x: x + tableW, y: rowY },
      thickness: 0.35,
      color: pal.borderLight,
    });

    page.drawRectangle({
      x: x + 2,
      y: rowY + 3,
      width: hourColW - 4,
      height: rowH - 6,
      color: pal.surfaceRaised,
      borderColor: pal.borderLight,
      borderWidth: 0.3,
    });
    drawCenteredText(page, String(les), x, rowY + rowH * 0.32, hourColW, fontBold, 9, pal.primary);

    for (let di = 0; di < days.length; di++) {
      const day = days[di]!;
      const dx = x + hourColW + di * colW;
      const cell = cells.get(`${day}-${les}`);
      const text = cell?.lines.filter(Boolean).join('\n') || emptyLabel;
      drawLessonCell(page, dx, rowY, colW, rowH, text, font, pal, colorMode, emptyLabel);
    }
  }
  return yBottom;
}

export function drawPageFooter(
  page: PDFPage,
  margin: number,
  pageW: number,
  font: PDFFont,
  pal: BrandPalette,
  opts: { footer_note?: string | null; pageNum?: number; pageTotal?: number },
) {
  const y = margin + 4;
  page.drawLine({
    start: { x: margin, y: y + 14 },
    end: { x: pageW - margin, y: y + 14 },
    thickness: 0.4,
    color: pal.borderLight,
  });

  const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText(date, { x: margin, y, size: 7, font, color: pal.muted });

  if (opts.footer_note?.trim()) {
    const note = opts.footer_note.trim().slice(0, 90);
    const nw = font.widthOfTextAtSize(note, 7);
    page.drawText(note, { x: (pageW - nw) / 2, y, size: 7, font, color: pal.muted });
  }

  if (opts.pageNum != null && opts.pageTotal != null) {
    const p = `${opts.pageNum} / ${opts.pageTotal}`;
    const pw = font.widthOfTextAtSize(p, 7);
    page.drawText(p, { x: pageW - margin - pw, y, size: 7, font, color: pal.faint });
  }

  drawBrandWatermark(page, pageW, margin, font, pal);
}

/** Çarşaf liste, nöbet vb. — düşük profil başlık (tablo alanı maksimum) */
export function beginCompactSheetPage(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  pal: BrandPalette,
): number {
  drawPageChrome(page, pageW, pageH, margin, pal);
  const cx = pageW / 2;
  /** Üst şerit + güvenli boşluk — metin kırpılmasın */
  let y = pageH - margin - 14;

  const tc = 'T.C.';
  const tcSize = 8;
  const tcW = fontBold.widthOfTextAtSize(tc, tcSize);
  page.drawText(tc, { x: cx - tcW / 2, y, size: tcSize, font: fontBold, color: pal.primaryDark });
  y -= 11;

  const meb = 'MİLLÎ EĞİTİM BAKANLIĞI';
  const mebSize = 6.5;
  const mebW = font.widthOfTextAtSize(meb, mebSize);
  page.drawText(meb, { x: cx - mebW / 2, y, size: mebSize, font, color: pal.muted });
  y -= 12;

  const school = truncateToWidth(header.school_name, fontBold, 12, pageW - 2 * margin - 20);
  const schoolSize = school.length > 40 ? 11 : 12;
  const schoolW = fontBold.widthOfTextAtSize(school, schoolSize);
  page.drawText(school, { x: cx - schoolW / 2, y, size: schoolSize, font: fontBold, color: pal.primaryDark });
  y -= schoolSize + 4;

  const title = truncateToWidth(header.document_title, fontBold, 10, pageW - 2 * margin - 24);
  const titleW = fontBold.widthOfTextAtSize(title, 10);
  page.drawText(title, { x: cx - titleW / 2, y, size: 10, font: fontBold, color: pal.ink });
  y -= 11;

  const metaParts: string[] = [];
  if (header.class_section) metaParts.push(`${header.class_section} Şubesi`);
  if (header.academic_year?.trim()) metaParts.push(header.academic_year.trim());
  const sub = header.subtitle?.trim();
  if (sub && !metaParts.some((p) => p.toLocaleLowerCase('tr') === sub.toLocaleLowerCase('tr'))) {
    metaParts.push(sub);
  }
  if (metaParts.length) {
    const meta = metaParts.slice(0, 2).join('   ·   ');
    const metaT = truncateToWidth(meta, font, 7, pageW - 2 * margin - 28);
    const mw = font.widthOfTextAtSize(metaT, 7);
    page.drawText(metaT, { x: cx - mw / 2, y: y - 6, size: 7, font, color: pal.muted });
    y -= 10;
  }

  page.drawLine({
    start: { x: margin, y: y - 3 },
    end: { x: pageW - margin, y: y - 3 },
    thickness: 0.45,
    color: pal.borderLight,
  });
  return y - 10;
}

/** Sayfa başına chrome + header */
export function beginProPage(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  header: PdfHeaderInfo,
  pal: BrandPalette,
): number {
  drawPageChrome(page, pageW, pageH, margin, pal);
  return drawOfficialHeader(page, pageW, pageH - margin - 16, margin, font, fontBold, header, pal);
}
