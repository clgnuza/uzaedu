import type { PDFDocument, PDFPage, PDFFont } from 'pdf-lib';
import { DAY_LABELS, type ExportEntry } from './ders-dagit.export';
import {
  buildNotificationSayi,
  DEFAULT_NOTIFICATION_ACK,
  DEFAULT_NOTIFICATION_BODY,
  DEFAULT_NOTIFICATION_SUBJECT,
  DEFAULT_NOTIFICATION_TITLE,
  DEFAULT_TEACHER_SIGNATURE_LABEL,
  mergeNotificationTemplate,
} from './ders-dagit-notification-texts';
import type { BrandPalette } from './ders-dagit-pdf-brand';
import {
  drawOfficialLetterhead,
  drawOfficialReferenceBlock,
  formatOfficialDate,
} from './ders-dagit-pdf-official-letter';
import {
  buildScheduleGrid,
  drawCellText,
  drawPageFooter,
  paletteFor,
  wrapText,
  type PdfHeaderInfo,
  type PdfPrintTheme,
} from './ders-dagit-pdf-layout';
import { contentBottom, fitScheduleRowHeight } from './ders-dagit-pdf-space';

export type TeacherNotificationTeacher = {
  key: string;
  label: string;
  branch?: string | null;
  entries: ExportEntry[];
};

export type TeacherNotificationTexts = {
  notification_title?: string | null;
  notification_subject?: string | null;
  notification_ref?: string | null;
  notification_body?: string | null;
  notification_acknowledgement?: string | null;
  teacher_signature_label?: string | null;
  principal_signature_label?: string | null;
  principal_name?: string | null;
  footer_note?: string | null;
};

export function groupEntriesByTeacher(entries: ExportEntry[]): TeacherNotificationTeacher[] {
  const map = new Map<string, TeacherNotificationTeacher>();
  for (const e of entries) {
    const label = e.teacher_label?.trim() || '—';
    const key = e.user_id?.trim() || label;
    let row = map.get(key);
    if (!row) {
      row = { key, label, entries: [] };
      map.set(key, row);
    }
    row.entries.push(e);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function drawParagraphs(
  page: PDFPage,
  text: string,
  x: number,
  yStart: number,
  maxW: number,
  font: PDFFont,
  size: number,
  pal: BrandPalette,
): number {
  let y = yStart;
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  for (const block of blocks) {
    const para = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!para) continue;
    const lines = wrapText(para, font, size, maxW, 14);
    for (const line of lines) {
      page.drawText(line, { x, y, size, font, color: pal.ink });
      y -= size + 5;
    }
    y -= 9;
  }
  return y;
}

/** Tebliğ tablosu — okunaklı punto, sade çerçeve */
function drawNotificationScheduleTable(
  page: PDFPage,
  x: number,
  yTop: number,
  tableW: number,
  hourColW: number,
  rowH: number,
  days: number[],
  lessons: number[],
  cells: Map<string, { lines: string[] }>,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
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
    borderWidth: 0.6,
  });

  const headerY = yTop - rowH;
  page.drawRectangle({ x, y: headerY, width: tableW, height: rowH, color: pal.headerFill });
  drawCellText(page, 'SAAT', x + 2, headerY + 2, hourColW - 4, rowH - 4, fontBold, 8, pal.headerInk, 1);

  for (let di = 0; di < days.length; di++) {
    const dx = x + hourColW + di * colW;
    const label = (DAY_LABELS[days[di]!] ?? String(days[di])).toUpperCase().slice(0, 11);
    drawCellText(page, label, dx + 2, headerY + 2, colW - 4, rowH - 4, fontBold, 7.5, pal.headerInk, 1);
  }

  for (let li = 0; li < lessons.length; li++) {
    const les = lessons[li]!;
    const rowY = yTop - rowH * (li + 2);
    if (li % 2 === 1) {
      page.drawRectangle({ x, y: rowY, width: tableW, height: rowH, color: pal.altRow });
    }
    drawCellText(page, String(les), x + 2, rowY + 2, hourColW - 4, rowH - 4, fontBold, 9, pal.primary, 1);

    for (let di = 0; di < days.length; di++) {
      const dx = x + hourColW + di * colW;
      const cell = cells.get(`${days[di]}-${les}`);
      const text = cell?.lines?.length ? cell.lines.slice(0, 2).join('\n') : '—';
      drawCellText(page, text, dx + 3, rowY + 3, colW - 6, rowH - 6, font, 7.5, pal.ink, 2);
    }
  }

  return yBottom;
}

function drawTutanakSignatures(
  page: PDFPage,
  margin: number,
  pageW: number,
  sigTop: number,
  teacher: TeacherNotificationTeacher,
  texts: TeacherNotificationTexts,
  tarih: string,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
) {
  const colW = (pageW - 2 * margin - 20) / 2;
  const blocks = [
    {
      title: 'TEBLİĞ EDEN',
      label: texts.principal_signature_label?.trim() || 'Okul Müdürü',
      name: texts.principal_name?.trim() || '',
      role: 'Okul Müdürlüğü',
    },
    {
      title: 'TEBELLÜĞ EDEN',
      label: texts.teacher_signature_label?.trim() || DEFAULT_TEACHER_SIGNATURE_LABEL,
      name: teacher.label,
      role: teacher.branch?.trim() || 'Öğretmen',
    },
  ];

  blocks.forEach((b, i) => {
    const bx = margin + 8 + i * (colW + 12);
    const by = sigTop;
    page.drawRectangle({
      x: bx,
      y: by - 72,
      width: colW,
      height: 72,
      borderColor: pal.border,
      borderWidth: 0.5,
    });
    page.drawText(b.title, { x: bx + 8, y: by - 14, size: 8, font: fontBold, color: pal.primary });
    const rows: [string, string][] = [
      ['Adı Soyadı', b.name || '………………………………'],
      ['Görevi', b.role],
      ['Tarih', tarih],
      ['İmza', ''],
    ];
    let ry = by - 28;
    for (const [lbl, val] of rows) {
      page.drawText(`${lbl} :`, { x: bx + 8, y: ry, size: 7.5, font: fontBold, color: pal.muted });
      page.drawText(val.slice(0, 36), { x: bx + 58, y: ry, size: 7.5, font, color: pal.ink });
      ry -= 12;
    }
  });
}

function drawTeacherNotificationPage(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  baseHeader: PdfHeaderInfo,
  teacher: TeacherNotificationTeacher,
  texts: TeacherNotificationTexts,
  placeholders: Record<string, string>,
  workDays: number[],
  theme: PdfPrintTheme,
  pageNum: number,
  pageTotal: number,
  seq: number,
) {
  const pal = paletteFor(theme);
  const pageW = 595;
  const pageH = 842;
  const margin = 52;
  const bottomY = contentBottom(margin);
  const page = doc.addPage([pageW, pageH]);

  const docTitle = texts.notification_title?.trim() || DEFAULT_NOTIFICATION_TITLE;
  const tarih = placeholders['{{tarih}}'] || formatOfficialDate();
  const sayi = buildNotificationSayi(baseHeader.academic_year, seq, texts.notification_ref);
  const konu = texts.notification_subject?.trim() || DEFAULT_NOTIFICATION_SUBJECT;

  let y = drawOfficialLetterhead(
    page,
    pageW,
    pageH,
    margin,
    font,
    fontBold,
    {
      school_name: baseHeader.school_name,
      document_title: docTitle,
      academic_year: baseHeader.academic_year,
    },
    pal,
  );

  y = drawOfficialReferenceBlock(
    page,
    pageW,
    y,
    margin,
    font,
    fontBold,
    { sayi, konu, tarih },
    pal,
  );

  const bodyTpl = texts.notification_body?.trim() || DEFAULT_NOTIFICATION_BODY;
  const ackTpl = texts.notification_acknowledgement?.trim() || DEFAULT_NOTIFICATION_ACK;
  const ph = {
    ...placeholders,
    '{{ogretmen_adi}}': teacher.label,
    '{{brans}}': teacher.branch?.trim() || '—',
    '{{sayi}}': sayi,
    '{{konu}}': konu,
    '{{tarih}}': tarih,
  };
  const body = mergeNotificationTemplate(bodyTpl, ph);
  const ack = mergeNotificationTemplate(ackTpl, ph);

  const maxW = pageW - 2 * margin - 8;
  const hitap = `Sayın ${teacher.label.slice(0, 44)},`;
  page.drawText(hitap, { x: margin + 4, y, size: 9.5, font, color: pal.ink });
  y -= 18;

  y = drawParagraphs(page, body, margin + 4, y, maxW, font, 9.5, pal);
  y -= 10;

  const ackLines = wrapText(ack, font, 9, maxW - 20, 5);
  const ackBoxH = Math.max(32, ackLines.length * 11 + 14);
  const sigBlockH = 72;
  const sigTopY = bottomY + sigBlockH + 10;
  const ackY = sigTopY + 14;
  const minTableBottomY = ackY + ackBoxH + 16;

  const gridEntries = teacher.entries.map((e) => ({
    day_of_week: e.day_of_week,
    lesson_num: e.lesson_num,
    lines: [e.subject, e.class_section],
  }));
  const { days, lessons, cells } = buildScheduleGrid(gridEntries, workDays);
  const hourColW = 36;
  const tableW = pageW - 2 * margin;
  const rowH = fitScheduleRowHeight(y, minTableBottomY, lessons.length, 28);
  drawNotificationScheduleTable(
    page,
    margin,
    y,
    tableW,
    hourColW,
    rowH,
    days,
    lessons,
    cells,
    font,
    fontBold,
    pal,
  );

  page.drawRectangle({
    x: margin + 4,
    y: ackY,
    width: maxW,
    height: ackBoxH,
    borderColor: pal.borderLight,
    borderWidth: 0.4,
  });
  let ay = ackY + ackBoxH - 14;
  for (const line of ackLines) {
    page.drawText(line, { x: margin + 12, y: ay, size: 9, font, color: pal.ink });
    ay -= 11;
  }

  drawTutanakSignatures(page, margin, pageW, sigTopY, teacher, texts, tarih, font, fontBold, pal);

  drawPageFooter(page, margin, pageW, font, pal, {
    footer_note: texts.footer_note ?? baseHeader.footer_note,
    pageNum,
    pageTotal,
  });
}

export function appendTeacherNotificationPages(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  baseHeader: PdfHeaderInfo,
  teachers: TeacherNotificationTeacher[],
  texts: TeacherNotificationTexts,
  placeholders: Record<string, string>,
  workDays: number[],
  theme: PdfPrintTheme,
) {
  const list = teachers.filter((t) => t.entries.length > 0);
  const total = list.length;
  list.forEach((teacher, i) => {
    drawTeacherNotificationPage(
      doc,
      font,
      fontBold,
      baseHeader,
      teacher,
      texts,
      placeholders,
      workDays,
      theme,
      i + 1,
      total,
      i + 1,
    );
  });
}
