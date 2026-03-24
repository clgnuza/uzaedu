import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
/** @pdf-lib/fontkit: require ile CJS uyumlulugu; .default veya dogrudan export */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { OptikFormTemplate } from './entities/optik-form-template.entity';

function getDejaVuFontPaths(): { sans: string; bold: string } {
  try {
    const sans = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
    const bold = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
    return { sans, bold };
  } catch {
    const cwd = process.cwd();
    const base = join(cwd, 'node_modules', 'dejavu-fonts-ttf', 'ttf');
    return {
      sans: join(base, 'DejaVuSans.ttf'),
      bold: join(base, 'DejaVuSans-Bold.ttf'),
    };
  }
}
const FONT_PATHS = getDejaVuFontPaths();

/** Turkce karakterleri ASCII'ye donustur – fallback icin */
function toAsciiSafe(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/\u0131/g, 'i').replace(/\u0130/g, 'I')
    .replace(/\u011F/g, 'g').replace(/\u011E/g, 'G')
    .replace(/\u00FC/g, 'u').replace(/\u00DC/g, 'U')
    .replace(/\u015F/g, 's').replace(/\u015E/g, 'S')
    .replace(/\u00F6/g, 'o').replace(/\u00D6/g, 'O')
    .replace(/\u00E7/g, 'c').replace(/\u00C7/g, 'C')
    .replace(/\u00E2/g, 'a').replace(/\u00C2/g, 'A')
    .replace(/\u00EE/g, 'i').replace(/\u00CE/g, 'I')
    .replace(/\u00FB/g, 'u').replace(/\u00DB/g, 'U')
    .replace(/[^\x00-\xFF]/g, '?');
}

const round10 = (n: number) => Math.round(n * 10) / 10;

/** Ogrenci No satir gorunumu – CEVAPLAR gibi: 0-9 ustte, her satir bir hane, bubble'lar yatay. */
function drawStudentNoRows(
  page: { drawCircle: (o: object) => void; drawText: (text: string, options?: object) => void; drawRectangle: (o: object) => void; drawLine: (o: object) => void },
  xLeft: number,
  yTop: number,
  numDigits: number,
  rowHeight: number,
  optionHeaderH: number,
  bubbleSize: number,
  numberW: number,
  choiceSpacing: number,
  lineColor: ReturnType<typeof rgb>,
  font: unknown,
  fontBold: unknown,
  textColor: ReturnType<typeof rgb>,
) {
  const innerPad = 6;
  const optionY = yTop - optionHeaderH + 2;
  for (let d = 0; d <= 9; d++) {
    const cx = round10(xLeft + numberW + innerPad + d * choiceSpacing + choiceSpacing / 2);
    page.drawText(String(d), { x: cx - 2, y: optionY, size: 6, font: fontBold as import('pdf-lib').PDFFont, color: textColor });
  }
  const rowsTop = yTop - optionHeaderH;
  for (let r = 0; r < numDigits; r++) {
    const rowBottom = rowsTop - (r + 1) * rowHeight;
    if (r % 2 === 1) {
      page.drawRectangle({
        x: xLeft,
        y: rowBottom,
        width: numberW + 10 * choiceSpacing + innerPad * 2,
        height: rowHeight,
        color: rgb(0.992, 0.992, 0.992),
      });
    }
    page.drawLine({
      start: { x: xLeft, y: rowsTop - r * rowHeight },
      end: { x: xLeft + numberW + 10 * choiceSpacing + innerPad * 2, y: rowsTop - r * rowHeight },
      thickness: 0.2,
      color: rgb(0.92, 0.92, 0.92),
    });
    const rowCenterY = rowsTop - r * rowHeight - rowHeight / 2;
    page.drawText(`${r + 1}.`, {
      x: xLeft + 1,
      y: rowCenterY - 3,
      size: 8,
      font: font as import('pdf-lib').PDFFont,
      color: textColor,
    });
    for (let d = 0; d <= 9; d++) {
      const cx = round10(xLeft + numberW + innerPad + d * choiceSpacing + choiceSpacing / 2);
      page.drawCircle({
        x: cx,
        y: round10(rowCenterY),
        size: bubbleSize,
        borderColor: lineColor,
        borderWidth: 0.7,
      });
    }
  }
  page.drawLine({
    start: { x: xLeft, y: rowsTop - numDigits * rowHeight },
    end: { x: xLeft + numberW + 10 * choiceSpacing + innerPad * 2, y: rowsTop - numDigits * rowHeight },
    thickness: 0.2,
    color: rgb(0.92, 0.92, 0.92),
  });
}

/** A-Z harf grid – her sutun bir karakter, satirlar A..Z. Yuvarlama ile kayma onlenir. */
function drawLetterGrid(
  page: { drawCircle: (o: object) => void },
  xBase: number,
  yBase: number,
  numCols: number,
  bubbleSize: number,
  rowSpacing: number,
  colSpacing: number,
  lineColor: ReturnType<typeof rgb>,
) {
  const baseX = Math.round(xBase * 10) / 10;
  const baseY = Math.round(yBase * 10) / 10;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let col = 0; col < numCols; col++) {
    for (let i = 0; i < letters.length; i++) {
      const cx = baseX + col * colSpacing;
      const cy = baseY - i * rowSpacing;
      page.drawCircle({ x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10, size: bubbleSize, borderColor: lineColor, borderWidth: 0.5 });
    }
  }
}

/** Flutter tarafinda perspektif duzeltme icin koselere sabit markerlar */
function drawAnchorMarkers(
  page: {
    drawRectangle: (o: object) => void;
  },
  pageWidth: number,
  pageHeight: number,
  margin: number,
) {
  const marker = 7;
  const inset = 10;
  const color = rgb(0, 0, 0);

  page.drawRectangle({ x: margin - inset, y: pageHeight - margin + inset - marker, width: marker, height: marker, color });
  page.drawRectangle({ x: pageWidth - margin + inset - marker, y: pageHeight - margin + inset - marker, width: marker, height: marker, color });
  page.drawRectangle({ x: margin - inset, y: margin - inset, width: marker, height: marker, color });
  page.drawRectangle({ x: pageWidth - margin + inset - marker, y: margin - inset, width: marker, height: marker, color });
}

/** Test blogu – LGS/YKS coklu ders */
interface TestBlock {
  label: string;
  questionCount: number;
  choiceCount: number;
}

/** LGS MEB dagilimi: Sozel 50 + Sayisal 40 = 90 soru */
const LGS_BLOCKS: TestBlock[] = [
  { label: 'Türkçe', questionCount: 20, choiceCount: 4 },
  { label: 'Matematik', questionCount: 20, choiceCount: 4 },
  { label: 'Fen Bilimleri', questionCount: 20, choiceCount: 4 },
  { label: 'TC İnkılap Tarihi', questionCount: 10, choiceCount: 4 },
  { label: 'Din Kültürü', questionCount: 10, choiceCount: 4 },
  { label: 'Yabancı Dil', questionCount: 10, choiceCount: 4 },
];

/** YKS TYT dagilimi: 120 soru */
const YKS_TYT_BLOCKS: TestBlock[] = [
  { label: 'Türkçe', questionCount: 40, choiceCount: 4 },
  { label: 'Sosyal Bilimler', questionCount: 20, choiceCount: 4 },
  { label: 'Temel Matematik', questionCount: 40, choiceCount: 4 },
  { label: 'Fen Bilimleri', questionCount: 20, choiceCount: 4 },
];

/** Modern optik form PDF – Cozum Optik referansi; pembe OMR, net bolumler */
@Injectable()
export class OptikFormPdfService {
  private readonly A4_WIDTH = 595.28;
  private readonly A4_HEIGHT = 841.89;
  private readonly MARGIN = 40;
  private readonly BUBBLE_SIZE = 5;       // CEVAPLAR icin – ust uste gelmemesi icin
  private readonly ID_BUBBLE_SIZE = 4.5;
  private readonly CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Modern tasarim – minimal, net, okunakli (Remark/Carbon referans)
  private readonly ACCENT = rgb(0.45, 0.55, 0.95);            // mavi accent – guven, profesyonellik
  private readonly ACCENT_SOFT = rgb(0.93, 0.95, 1);          // cok acik mavi arka plan
  private readonly BUBBLE_BORDER = rgb(0, 0, 0);              // Scanner-safe: maksimum kontrast
  private readonly BLOCK_BG = rgb(1, 1, 1);                   // OMR alaninda beyaz arka plan
  private readonly HEADER_COLOR = rgb(0.12, 0.14, 0.2);       // koyu header
  private readonly ALIGN_STRIP = rgb(0.08, 0.1, 0.14);
  private readonly BORDER_COLOR = rgb(0.9, 0.91, 0.93);
  private readonly TEXT_PRIMARY = rgb(0.12, 0.14, 0.18);
  private readonly TEXT_MUTED = rgb(0.5, 0.53, 0.58);
  private readonly WARN_BG = rgb(0.99, 0.97, 0.93);
  private readonly WARN_BORDER = rgb(0.92, 0.85, 0.7);

  async generatePdf(
    template: OptikFormTemplate | Record<string, unknown>,
    options?: { prependBlank?: number },
  ): Promise<Buffer> {
    const prependBlank = Math.min(5, Math.max(0, options?.prependBlank ?? 0));
    const formDoc = await this.buildSinglePageFormDocument(template);
    if (prependBlank === 0) {
      const bytes = await formDoc.save({ addDefaultPage: false });
      return Buffer.from(bytes);
    }
    const merged = await PDFDocument.create();
    const w = this.A4_WIDTH;
    const h = this.A4_HEIGHT;
    for (let i = 0; i < prependBlank; i++) {
      merged.addPage([w, h]);
    }
    const [copied] = await merged.copyPages(formDoc, [0]);
    merged.addPage(copied);
    const bytes = await merged.save({ addDefaultPage: false });
    return Buffer.from(bytes);
  }

  /** Tek sayfa optik formu (bos yazili sayfasi yok); prepend icin generatePdf copyPages kullanir */
  private async buildSinglePageFormDocument(
    template: OptikFormTemplate | Record<string, unknown>,
  ): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    let font: import('pdf-lib').PDFFont;
    let fontBold: import('pdf-lib').PDFFont;
    let useTurkish = false;

    try {
      if (existsSync(FONT_PATHS.sans) && existsSync(FONT_PATHS.bold)) {
        doc.registerFontkit(fontkit);
        const sansBytes = new Uint8Array(readFileSync(FONT_PATHS.sans));
        const boldBytes = new Uint8Array(readFileSync(FONT_PATHS.bold));
        font = await doc.embedFont(sansBytes);
        fontBold = await doc.embedFont(boldBytes);
        useTurkish = true;
      } else {
        throw new Error(`Font bulunamadi: ${FONT_PATHS.sans}`);
      }
    } catch (err) {
      console.warn('[OptikFormPdf] DejaVu yuklenemedi, Helvetica kullaniliyor:', (err as Error).message);
      font = await doc.embedFont(StandardFonts.Helvetica);
      fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    }

    const txt = (s: string) => (useTurkish ? s : toAsciiSafe(s));

    const pageWidth = this.A4_WIDTH;
    const pageHeight = this.A4_HEIGHT;
    const margin = this.MARGIN;

    const t = template as {
      questionCount?: number;
      choiceCount?: number;
      name?: string;
      gradeLevel?: string | null;
      slug?: string;
      roiConfig?: { test_blocks?: TestBlock[] } | null;
    };
    const name = String(t.name ?? 'Optik Form');

    let blocks: TestBlock[];
    if (Array.isArray(t.roiConfig?.test_blocks) && t.roiConfig.test_blocks.length > 0) {
      blocks = t.roiConfig.test_blocks;
    } else if (t.gradeLevel === 'LGS' || /^lgs/i.test(String(t.slug ?? ''))) {
      blocks = LGS_BLOCKS;
    } else if ((t.gradeLevel === 'YKS' || /^yks/i.test(String(t.slug ?? ''))) && /tyt|120/i.test(String(t.slug ?? ''))) {
      blocks = YKS_TYT_BLOCKS;
    } else {
      const q = Math.max(1, t.questionCount ?? 20);
      const c = Math.max(1, Math.min(t.choiceCount ?? 5, 6));
      blocks = [{ label: 'CEVAPLAR', questionCount: q, choiceCount: c }];
    }
    const questionCount = blocks.reduce((s, b) => s + b.questionCount, 0);

    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // —— 1. Modern Header (lacivert) ——
    const headerHeight = 32;
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight,
      width: pageWidth,
      height: headerHeight,
      color: this.HEADER_COLOR,
    });
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight + 2,
      width: pageWidth,
      height: 2,
      color: this.ACCENT,
    });
    page.drawText(txt('CEVAP KAĞIDI'), {
      x: margin,
      y: pageHeight - headerHeight + 10,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(txt(name), {
      x: pageWidth - margin - 180,
      y: pageHeight - headerHeight + 11,
      size: 12,
      font: font,
      color: rgb(0.95, 0.96, 0.98),
    });
    y -= headerHeight + 24;

    // Flutter OMR: her sayfada sabit anchor markerlar
    drawAnchorMarkers(page, pageWidth, pageHeight, margin);

    // Sol hizalama seridi (OMR okuyucu icin – Cozum referansi)
    const stripWidth = 8;
    page.drawRectangle({
      x: 0,
      y: margin,
      width: stripWidth,
      height: pageHeight - 2 * margin,
      color: this.ALIGN_STRIP,
    });
    for (let i = 0; i < 25; i++) {
      const sy = margin + 15 + i * 32;
      page.drawRectangle({
        x: 2,
        y: sy,
        width: 4,
        height: 1,
        color: rgb(0.95, 0.95, 0.97),
      });
    }

    const contentX = margin + stripWidth + 12;
    const contentW = pageWidth - margin - contentX;
    const cardPad = 16;
    const cardInnerX = contentX + cardPad;
    const cardInnerW = contentW - 2 * cardPad;
    // CEVAPLAR ile ayni satir yuksekligi ve bubble boyutu
    const idRowHeight = 10;
    const idBubbleSize = 3.6;
    const idMinChoiceSpacing = 2 * idBubbleSize + 2.2;
    const idOptionHeaderH = 10;
    const idDigitRows = 5;

    // —— Öğrenci bilgileri kartı: 2 sütun, CEVAPLAR satir/bubble formati ——
    const idColGap = 12;
    const idColW = (cardInnerW - idColGap) / 2;
    const idLabelW = 72;
    const cardHeaderH = 22;
    const leftRowHeights = [idRowHeight, idRowHeight, idRowHeight, idRowHeight, idRowHeight * 2 + 4];
    const cardBodyH = Math.max(
      leftRowHeights.reduce((a, b) => a + b, 0) + 18,
      idOptionHeaderH + idDigitRows * idRowHeight + 20,
    ) + 8;
    const topBlockH = cardHeaderH + cardBodyH;
    const topBlockY = y;
    const topBlockX = contentX;
    const topBlockW = contentW;
    const cardBottom = topBlockY - topBlockH;

    page.drawRectangle({
      x: topBlockX,
      y: cardBottom,
      width: topBlockW,
      height: topBlockH,
      color: rgb(1, 1, 1),
      borderColor: this.BORDER_COLOR,
      borderWidth: 0.8,
    });
    page.drawRectangle({
      x: topBlockX,
      y: topBlockY - cardHeaderH,
      width: topBlockW,
      height: cardHeaderH,
      color: this.ACCENT_SOFT,
      borderColor: this.ACCENT,
      borderWidth: 0,
    });
    page.drawLine({
      start: { x: topBlockX, y: topBlockY - cardHeaderH },
      end: { x: topBlockX + 4, y: topBlockY - cardHeaderH },
      thickness: 3,
      color: this.ACCENT,
    });
    page.drawText(txt('ÖĞRENCİ BİLGİLERİ'), {
      x: cardInnerX,
      y: topBlockY - cardHeaderH + 7,
      size: 10,
      font: fontBold,
      color: this.ACCENT,
    });

    const colDivX = cardInnerX + idColW + idColGap / 2;
    page.drawLine({
      start: { x: colDivX, y: topBlockY - cardHeaderH },
      end: { x: colDivX, y: cardBottom },
      thickness: 0.4,
      color: this.BORDER_COLOR,
    });

    const leftRows: { label: string; type: 'line' | 'bubble'; labels?: string[]; cols?: number }[] = [
      { label: 'Adı / Soyadı', type: 'line' },
      { label: 'Testin Adı', type: 'line' },
      { label: 'Sınav Tarihi', type: 'line' },
      { label: 'Kitapçık', type: 'bubble', labels: ['A', 'B'], cols: 2 },
      { label: 'Sınıf', type: 'bubble', labels: ['5', '6', '7', '8', '9', '10', '11', '12'], cols: 4 },
    ];
    const leftValX = cardInnerX + idLabelW;
    let leftRowTop = topBlockY - cardHeaderH - 8;

    leftRows.forEach((r, idx) => {
      const rowH = leftRowHeights[idx];
      const rowCenterY = leftRowTop - rowH / 2;
      const rowBottom = leftRowTop - rowH;

      if (idx % 2 === 1) {
        page.drawRectangle({
          x: cardInnerX,
          y: rowBottom,
          width: idColW,
          height: rowH,
          color: rgb(0.992, 0.992, 0.992),
        });
      }
      page.drawLine({
        start: { x: cardInnerX, y: leftRowTop },
        end: { x: cardInnerX + idColW, y: leftRowTop },
        thickness: 0.2,
        color: rgb(0.92, 0.92, 0.92),
      });

      const labelY = r.type === 'bubble' ? rowCenterY - 4 : rowCenterY - 3;
      page.drawText(txt(r.label), {
        x: cardInnerX + 2,
        y: labelY,
        size: 8,
        font: fontBold,
        color: r.type === 'line' ? this.TEXT_MUTED : this.ACCENT,
      });

      if (r.type === 'line') {
        page.drawLine({
          start: { x: leftValX, y: rowCenterY - 4 },
          end: { x: cardInnerX + idColW - 4, y: rowCenterY - 4 },
          thickness: 0.5,
          color: this.BORDER_COLOR,
        });
      } else if (r.type === 'bubble' && r.labels) {
        const bubbleY = round10(rowCenterY);
        const cols = r.cols ?? 5;
        const isKitapcik = r.label === 'Kitapçık';
        const isSinif = r.label === 'Sınıf';
        const bubbleLabelStyle = isKitapcik || isSinif;
        const choiceW = Math.max(
          idMinChoiceSpacing + (bubbleLabelStyle ? 10 : 0),
          (idColW - idLabelW - 12) / cols,
        );
        r.labels.forEach((lbl, i) => {
          const col = i % cols;
          const crow = Math.floor(i / cols);
          const cyOffset = r.labels!.length > 2 ? (crow === 0 ? idRowHeight / 2 : -idRowHeight / 2) : 0;
          const cx = round10(leftValX + col * choiceW + choiceW / 2);
          const cy = round10(bubbleY + cyOffset);
          page.drawCircle({ x: cx, y: cy, size: idBubbleSize, borderColor: this.BUBBLE_BORDER, borderWidth: 0.7 });
          const lblX = bubbleLabelStyle ? (lbl.length > 1 ? 16 : 12) : (lbl.length > 1 ? 5 : 2);
          const lblY = bubbleLabelStyle ? cy - 3 : round10(cy - idRowHeight / 2 - 2);
          page.drawText(txt(lbl), { x: cx - lblX, y: lblY, size: 6, font, color: this.TEXT_MUTED });
        });
      }
      leftRowTop -= rowH;
    });

    page.drawLine({
      start: { x: cardInnerX, y: cardBottom + 8 },
      end: { x: cardInnerX + idColW, y: cardBottom + 8 },
      thickness: 0.2,
      color: rgb(0.92, 0.92, 0.92),
    });

    const rightColX = colDivX + idColGap / 2;
    const idNumberW = 18;
    const idDigitChoiceSpacing = Math.max(idMinChoiceSpacing, (idColW - idNumberW - 20) / 10);
    const digitBlockTop = topBlockY - cardHeaderH - 8;
    page.drawText(txt('Öğrenci No (5 hane)'), {
      x: rightColX,
      y: digitBlockTop,
      size: 8,
      font: fontBold,
      color: this.ACCENT,
    });
    drawStudentNoRows(
      page,
      rightColX,
      round10(digitBlockTop - 8),
      idDigitRows,
      idRowHeight,
      idOptionHeaderH,
      idBubbleSize,
      idNumberW,
      idDigitChoiceSpacing,
      this.BUBBLE_BORDER,
      font,
      fontBold,
      this.TEXT_MUTED,
    );

    y = cardBottom - 14;

    // Cevap alanı tek sayfaya sığacak dinamik grid
    const cevaplarX = contentX;
    const cevaplarWidth = contentW;
    const sectionHeight = 20;
    const blockHeaderH = 14;
    const optionHeaderH = 10;
    const colGap = 8;

    // Soru yoğunluğuna göre sütun sayısı
    let numCols = questionCount >= 100 ? 5 : questionCount >= 70 ? 4 : questionCount >= 35 ? 3 : 2;
    const maxChoiceCount = Math.max(...blocks.map((b) => Math.max(1, Math.min(6, b.choiceCount))));
    const minBubbleSize = 3.6;
    const minChoiceSpacing = 2 * minBubbleSize + 2.2;
    while (numCols > 2) {
      const qw = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
      const minCellW = 18 + maxChoiceCount * minChoiceSpacing + 8;
      if (qw >= minCellW) break;
      numCols -= 1;
    }

    const totalRows = blocks.reduce((s, b) => s + Math.ceil(b.questionCount / numCols), 0);
    const fixedH = sectionHeight + blocks.length * (blockHeaderH + optionHeaderH + 8) + 10;
    const availableH = Math.max(160, y - margin - 8);
    const rowHeight = Math.max(8, Math.min(12, Math.floor((availableH - fixedH) / Math.max(1, totalRows))));
    const answerBubble = Math.max(3.2, Math.min(4.4, rowHeight * 0.34));
    const questionWidth = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
    const numberW = 18;
    const innerPad = 8;

    page.drawRectangle({
      x: cevaplarX, y: y - sectionHeight, width: cevaplarWidth, height: sectionHeight, color: this.ACCENT_SOFT,
    });
    page.drawLine({
      start: { x: cevaplarX, y: y - sectionHeight },
      end: { x: cevaplarX + 4, y: y - sectionHeight },
      thickness: 3,
      color: this.ACCENT,
    });
    page.drawText(txt('CEVAPLAR'), { x: cevaplarX + 12, y: y - 14, size: 10, font: fontBold, color: this.ACCENT });
    y -= sectionHeight + 10;

    for (const blk of blocks) {
      const blkChoiceCount = Math.max(1, Math.min(blk.choiceCount, 6));
      const rowsPerCol = Math.ceil(blk.questionCount / numCols);
      const blockBodyH = rowsPerCol * rowHeight;

      // Ders başlığı (tek blok CEVAPLAR ise tekrar başlık çizme)
      if ((blk.label || '').toLocaleUpperCase('tr-TR') !== 'CEVAPLAR') {
        page.drawRectangle({
          x: cevaplarX, y: y - blockHeaderH, width: cevaplarWidth, height: blockHeaderH, color: this.ACCENT_SOFT,
        });
        page.drawText(txt((blk.label || 'CEVAPLAR').toLocaleUpperCase('tr-TR')), {
          x: cevaplarX + 6, y: y - 11, size: 8, font: fontBold, color: this.ACCENT,
        });
        y -= blockHeaderH;
      }

      // ABCD satırı (her sütunda bir kez)
      const optionY = y - optionHeaderH + 2;
      for (let col = 0; col < numCols; col++) {
        const xColLeft = cevaplarX + col * (questionWidth + colGap);
        const choiceW = Math.max(minChoiceSpacing, (questionWidth - numberW - innerPad) / blkChoiceCount);
        for (let c = 0; c < blkChoiceCount; c++) {
          const cx = xColLeft + numberW + c * choiceW + choiceW / 2;
          const lbl = this.CHOICE_LABELS[c] ?? String(c + 1);
          page.drawText(txt(lbl), { x: cx - 2, y: optionY, size: 6, font: fontBold, color: this.TEXT_MUTED });
        }
      }
      y -= optionHeaderH;

      const rowsTop = y;

      // Satır karışmasını azaltan çok açık alt fon (okumayı etkilemeyecek ton)
      for (let r = 0; r < rowsPerCol; r++) {
        if (r % 2 === 1) {
          page.drawRectangle({
            x: cevaplarX,
            y: rowsTop - (r + 1) * rowHeight,
            width: cevaplarWidth,
            height: rowHeight,
            color: rgb(0.992, 0.992, 0.992),
          });
        }
        page.drawLine({
          start: { x: cevaplarX, y: rowsTop - r * rowHeight },
          end: { x: cevaplarX + cevaplarWidth, y: rowsTop - r * rowHeight },
          thickness: 0.2,
          color: rgb(0.92, 0.92, 0.92),
        });
      }

      for (let q = 0; q < blk.questionCount; q++) {
        const qInBlock = q + 1;
        const col = Math.floor(q / rowsPerCol);
        const row = q % rowsPerCol;
        const xColLeft = cevaplarX + col * (questionWidth + colGap);
        const rowCenterY = rowsTop - row * rowHeight - rowHeight / 2;
        const choiceW = Math.max(minChoiceSpacing, (questionWidth - numberW - innerPad) / blkChoiceCount);

        // Soru no
        page.drawText(`${qInBlock}.`, {
          x: xColLeft + 1,
          y: rowCenterY - 3,
          size: 8,
          font,
          color: this.TEXT_PRIMARY,
        });

        // İşaretleme kutucukları (ABCD hizalı)
        for (let c = 0; c < blkChoiceCount; c++) {
          const cx = xColLeft + numberW + c * choiceW + choiceW / 2;
          page.drawCircle({
            x: Math.round(cx * 10) / 10,
            y: Math.round(rowCenterY * 10) / 10,
            size: answerBubble,
            borderColor: this.BUBBLE_BORDER,
            borderWidth: 0.7,
          });
        }
      }

      y -= blockBodyH + 8;
    }

    return doc;
  }
}
