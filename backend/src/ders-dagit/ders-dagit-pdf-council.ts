import type { PDFPage, PDFFont } from 'pdf-lib';
import {
  beginProPage,
  drawCellText,
  drawPageFooter,
  paletteFor,
  type PdfHeaderInfo,
  type PdfPrintTheme,
} from './ders-dagit-pdf-layout';
import { drawSignatureBlock, type BrandPalette } from './ders-dagit-pdf-brand';
import { contentBottom } from './ders-dagit-pdf-space';
import {
  applyCouncilTextPlaceholders,
  councilTextContextFrom,
  DEFAULT_COUNCIL_AGENDA,
  DEFAULT_COUNCIL_APPROVAL_TEXT,
  DEFAULT_COUNCIL_MEETING_PLACE,
  DEFAULT_COUNCIL_MEETING_TOPIC,
  splitAgendaItems,
  splitCouncilDecisions,
} from './ders-dagit-council-texts';
import { formatOfficialDate } from './ders-dagit-pdf-official-letter';

export type CouncilPdfOpts = {
  school_name: string;
  program_name: string;
  academic_year?: string | null;
  entry_count: number;
  class_count: number;
  teacher_count: number;
  by_class: Array<{ section: string; weekly_slots: number }>;
  participants: string[];
  meeting_place?: string | null;
  meeting_topic?: string | null;
  agenda_text?: string | null;
  approval_text?: string | null;
  principal_name?: string | null;
  principal_signature_label?: string | null;
  footer_note?: string | null;
  address?: string | null;
  phone?: string | null;
};

type PdfFonts = { font: PDFFont; fontBold: PDFFont };

function ensurePage(
  doc: import('pdf-lib').PDFDocument,
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  y: number,
  header: PdfHeaderInfo,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
  minY: number,
): { page: PDFPage; y: number } {
  if (y >= minY) return { page, y };
  const next = doc.addPage([pageW, pageH]);
  const ny = beginProPage(next, pageW, pageH, margin, font, fontBold, header, pal) - 12;
  return { page: next, y: ny };
}

function drawSectionTitle(
  page: PDFPage,
  margin: number,
  y: number,
  title: string,
  fontBold: PDFFont,
  pal: BrandPalette,
): number {
  page.drawText(title, { x: margin + 4, y, size: 9.5, font: fontBold, color: pal.primaryDark });
  page.drawLine({
    start: { x: margin + 4, y: y - 3 },
    end: { x: margin + 4 + 200, y: y - 3 },
    thickness: 0.5,
    color: pal.border,
  });
  return y - 14;
}

function drawInfoRow(
  page: PDFPage,
  margin: number,
  y: number,
  label: string,
  value: string,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
  pageW: number,
): number {
  const labelW = 118;
  const valW = pageW - 2 * margin - labelW - 16;
  page.drawText(label, { x: margin + 8, y, size: 8.5, font: fontBold, color: pal.ink });
  drawCellText(page, value, margin + 8 + labelW, y - 2, valW, 14, font, 8.5, pal.ink, 2);
  return y - 16;
}

function drawNumberedList(
  page: PDFPage,
  doc: import('pdf-lib').PDFDocument,
  pageW: number,
  pageH: number,
  margin: number,
  y: number,
  items: string[],
  header: PdfHeaderInfo,
  fonts: PdfFonts,
  pal: BrandPalette,
  minY: number,
): { page: PDFPage; y: number } {
  let { page: p, y: cy } = { page, y };
  const { font, fontBold } = fonts;
  for (let i = 0; i < items.length; i++) {
    ({ page: p, y: cy } = ensurePage(doc, p, pageW, pageH, margin, cy, header, font, fontBold, pal, minY));
    const item = items[i]!;
    const prefix = `${i + 1}. `;
    drawCellText(p, `${prefix}${item}`, margin + 12, cy - 2, pageW - 2 * margin - 20, 28, font, 8.5, pal.ink, 3);
    cy -= 22;
  }
  return { page: p, y: cy - 4 };
}

export async function buildCouncilPdfDocument(
  doc: import('pdf-lib').PDFDocument,
  fonts: PdfFonts,
  opts: CouncilPdfOpts,
  theme: PdfPrintTheme,
): Promise<Uint8Array> {
  const { font, fontBold } = fonts;
  const pal = paletteFor(theme);
  const pageW = 595;
  const pageH = 842;
  const margin = 52;
  const bottomY = contentBottom(margin);
  const minY = bottomY + 130;

  const ctx = councilTextContextFrom({
    school_name: opts.school_name,
    academic_year: opts.academic_year,
    program_name: opts.program_name,
    principal_name: opts.principal_name,
  });

  const meetingPlace = applyCouncilTextPlaceholders(
    opts.meeting_place?.trim() || DEFAULT_COUNCIL_MEETING_PLACE,
    ctx,
  );
  const meetingTopic = applyCouncilTextPlaceholders(
    opts.meeting_topic?.trim() || DEFAULT_COUNCIL_MEETING_TOPIC,
    ctx,
  );
  const agendaRaw = applyCouncilTextPlaceholders(
    opts.agenda_text?.trim() || DEFAULT_COUNCIL_AGENDA,
    ctx,
  );
  const decisionsRaw = applyCouncilTextPlaceholders(
    opts.approval_text?.trim() || DEFAULT_COUNCIL_APPROVAL_TEXT,
    ctx,
  );

  const now = new Date();
  const meetingDate = now.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const meetingTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const tutanakNo = `${ctx.ogretim_yili.replace(/\s/g, '')}/ZK-${formatOfficialDate(now).replace(/\./g, '')}`;

  const header: PdfHeaderInfo = {
    school_name: opts.school_name,
    document_title: 'ZÜMRE ÖĞRETMENLER KURULU TOPLANTI TUTANAĞI',
    subtitle: opts.program_name,
    academic_year: opts.academic_year,
    footer_note: opts.footer_note,
  };

  let page = doc.addPage([pageW, pageH]);
  let y = beginProPage(page, pageW, pageH, margin, font, fontBold, header, pal);

  page.drawText(`Tutanak No: ${tutanakNo}`, {
    x: pageW - margin - 8 - font.widthOfTextAtSize(`Tutanak No: ${tutanakNo}`, 8),
    y: y + 4,
    size: 8,
    font,
    color: pal.muted,
  });
  y -= 8;

  y = drawSectionTitle(page, margin, y, 'I. TOPLANTI BİLGİLERİ', fontBold, pal);
  y = drawInfoRow(page, margin, y, 'Eğitim-Öğretim Yılı', `${ctx.ogretim_yili} Eğitim-Öğretim Yılı`, font, fontBold, pal, pageW);
  y = drawInfoRow(page, margin, y, 'Toplantı Tarihi', meetingDate, font, fontBold, pal, pageW);
  y = drawInfoRow(page, margin, y, 'Toplantı Saati', meetingTime, font, fontBold, pal, pageW);
  y = drawInfoRow(page, margin, y, 'Toplantı Yeri', meetingPlace, font, fontBold, pal, pageW);
  y = drawInfoRow(page, margin, y, 'Toplantı Konusu', meetingTopic, font, fontBold, pal, pageW);
  if (opts.address?.trim()) {
    y = drawInfoRow(page, margin, y, 'Adres', opts.address.trim(), font, fontBold, pal, pageW);
  }
  if (opts.phone?.trim()) {
    y = drawInfoRow(page, margin, y, 'Telefon', opts.phone.trim(), font, fontBold, pal, pageW);
  }
  y -= 6;

  y = drawSectionTitle(page, margin, y, 'II. KATILIMCILAR', fontBold, pal);
  const participants =
    opts.participants.length > 0
      ? opts.participants
      : ['(Programda yerleşmiş öğretmen kaydı bulunmuyor)'];
  const partCols = 2;
  const partColW = (pageW - 2 * margin - 16) / partCols;
  let pi = 0;
  while (pi < Math.min(participants.length, 24)) {
    ({ page, y } = ensurePage(doc, page, pageW, pageH, margin, y, header, font, fontBold, pal, minY));
    for (let col = 0; col < partCols && pi < participants.length; col++) {
      const name = participants[pi]!;
      drawCellText(
        page,
        `• ${name}`,
        margin + 8 + col * partColW,
        y - 2,
        partColW - 8,
        14,
        font,
        8,
        pal.ink,
        1,
      );
      pi++;
    }
    y -= 18;
  }
  y -= 4;

  y = drawSectionTitle(page, margin, y, 'III. GÜNDEM', fontBold, pal);
  ({ page, y } = drawNumberedList(
    page,
    doc,
    pageW,
    pageH,
    margin,
    y,
    splitAgendaItems(agendaRaw),
    header,
    fonts,
    pal,
    minY,
  ));

  y = drawSectionTitle(page, margin, y, 'IV. GÖRÜŞÜLEN KONULAR', fontBold, pal);
  const summary = `Kurulumuzda hazırlanan "${opts.program_name}" kapsamında ${opts.class_count} şube, ${opts.teacher_count} öğretmen ve toplam ${opts.entry_count} ders saati yerleşimi incelenmiştir. Programın öğretim planına, haftalık ders dağılımına ve okul örgütüne uygunluğu değerlendirilmiştir.`;
  ({ page, y } = ensurePage(doc, page, pageW, pageH, margin, y, header, font, fontBold, pal, minY));
  drawCellText(page, summary, margin + 8, y - 2, pageW - 2 * margin - 16, 36, font, 8.5, pal.ink, 4);
  y -= 44;

  y = drawSectionTitle(page, margin, y, 'V. ALINAN KARARLAR', fontBold, pal);
  const decisions = splitCouncilDecisions(decisionsRaw);
  for (const dec of decisions) {
    ({ page, y } = ensurePage(doc, page, pageW, pageH, margin, y, header, font, fontBold, pal, minY));
    const boxH = Math.min(72, 18 + Math.ceil(dec.length / 70) * 11);
    const boxY = y - boxH;
    page.drawRectangle({
      x: margin + 8,
      y: boxY,
      width: pageW - 2 * margin - 16,
      height: boxH,
      color: pal.surfaceRaised,
      borderColor: pal.borderLight,
      borderWidth: 0.4,
    });
    drawCellText(page, dec, margin + 14, boxY + 4, pageW - 2 * margin - 28, boxH - 6, font, 8.5, pal.ink, 5);
    y = boxY - 10;
  }

  y = drawSectionTitle(page, margin, y, 'EK-1 — ŞUBE BAZINDA HAFTALIK DERS SAATİ', fontBold, pal);
  const tableX = margin + 8;
  const tableW = pageW - 2 * margin - 16;
  const col1 = tableW * 0.68;
  const rowH = 18;
  const rows = opts.by_class.slice(0, 32);
  const tableH = rowH * (rows.length + 1);
  ({ page, y } = ensurePage(doc, page, pageW, pageH, margin, y - tableH, header, font, fontBold, pal, minY + tableH));
  const tableTop = y;
  page.drawRectangle({
    x: tableX,
    y: tableTop - tableH,
    width: tableW,
    height: tableH,
    borderColor: pal.border,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: tableX,
    y: tableTop - rowH,
    width: tableW,
    height: rowH,
    color: pal.headerFill,
  });
  page.drawText('Şube / Sınıf', {
    x: tableX + 8,
    y: tableTop - rowH + 5,
    size: 8,
    font: fontBold,
    color: pal.headerInk,
  });
  page.drawText('Haftalık ders saati', {
    x: tableX + col1 + 8,
    y: tableTop - rowH + 5,
    size: 8,
    font: fontBold,
    color: pal.headerInk,
  });
  let ty = tableTop - rowH;
  for (let ri = 0; ri < rows.length; ri++) {
    ty -= rowH;
    const row = rows[ri]!;
    if (ri % 2 === 1) {
      page.drawRectangle({ x: tableX, y: ty, width: tableW, height: rowH, color: pal.altRow });
    }
    drawCellText(page, row.section, tableX + 4, ty + 2, col1 - 8, rowH - 4, font, 8, pal.ink, 1);
    page.drawText(String(row.weekly_slots), {
      x: tableX + col1 + 10,
      y: ty + 5,
      size: 8,
      font: fontBold,
      color: pal.primary,
    });
  }
  y = tableTop - tableH - 20;

  ({ page, y } = ensurePage(doc, page, pageW, pageH, margin, y, header, font, fontBold, pal, minY));
  y = drawSectionTitle(page, margin, y, 'VI. İMZA', fontBold, pal);

  const sigW = (pageW - 2 * margin - 32) / 3;
  const sigTop = Math.max(bottomY + 100, y - 70);
  const principalLabel = opts.principal_signature_label?.trim() || 'Okul Müdürü';
  drawSignatureBlock(
    page,
    margin + 8,
    sigTop,
    sigW,
    principalLabel,
    opts.principal_name ?? undefined,
    font,
    fontBold,
    pal,
  );
  drawSignatureBlock(page, margin + 16 + sigW, sigTop, sigW, 'Zümre Başkanı', undefined, font, fontBold, pal);
  drawSignatureBlock(page, margin + 24 + sigW * 2, sigTop, sigW, 'Katılımcılar', undefined, font, fontBold, pal);

  page.drawText('Katılımcı öğretmenler yukarıda belirtilmiş olup tutanağı okudum, kararları kabul ediyorum.', {
    x: margin + 8,
    y: sigTop - 62,
    size: 7.5,
    font,
    color: pal.muted,
  });

  drawPageFooter(page, margin, pageW, font, pal, { footer_note: opts.footer_note });
  return doc.save();
}
