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

/** ?prepend_blank=1 yalnizca acikca 1..5 ise bos sayfa ekler */
export function parsePrependBlankQuery(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return 0;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(5, n);
}

type PdfDrawPage = {
  drawCircle: (o: object) => void;
  drawText: (text: string, options?: object) => void;
  drawRectangle: (o: object) => void;
  drawLine: (o: object) => void;
};

type PdfFont = import('pdf-lib').PDFFont;

interface CodeBubbleStyle {
  bubbleSize: number;
  rowHeight: number;
  headerH: number;
  labelColW: number;
  choiceSpacing: number;
  lineColor: ReturnType<typeof rgb>;
  headerBg: ReturnType<typeof rgb>;
  rowAlt: ReturnType<typeof rgb>;
  rowLine: ReturnType<typeof rgb>;
  font: PdfFont;
  fontBold: PdfFont;
  textColor: ReturnType<typeof rgb>;
  labelColor: ReturnType<typeof rgb>;
}

/** Secenek adlari balonun ustunde, CEVAPLAR ile ayni hiza */
function drawChoiceHeaderRow(
  page: PdfDrawPage,
  xGrid: number,
  yHeaderBottom: number,
  choiceLabels: string[],
  spacing: number,
  st: CodeBubbleStyle,
) {
  const gridW = choiceLabels.length * spacing;
  page.drawRectangle({
    x: xGrid,
    y: yHeaderBottom - st.headerH,
    width: gridW,
    height: st.headerH,
    color: st.headerBg,
  });
  for (let i = 0; i < choiceLabels.length; i++) {
    const cx = round10(xGrid + i * spacing + spacing / 2);
    const lbl = choiceLabels[i]!;
    const lw = st.fontBold.widthOfTextAtSize(lbl, 7);
    page.drawText(lbl, {
      x: cx - lw / 2,
      y: yHeaderBottom - st.headerH + 3,
      size: 7,
      font: st.fontBold,
      color: st.labelColor,
    });
  }
}

function drawChoiceBubbleRow(
  page: PdfDrawPage,
  xGrid: number,
  yRowCenter: number,
  colCount: number,
  spacing: number,
  st: CodeBubbleStyle,
  rowLabel: string | null,
  zebra: boolean,
) {
  const gridW = colCount * spacing;
  if (zebra) {
    page.drawRectangle({
      x: xGrid - 2,
      y: yRowCenter - st.rowHeight / 2,
      width: gridW + 4,
      height: st.rowHeight,
      color: st.rowAlt,
    });
  }
  if (rowLabel) {
    page.drawText(rowLabel, {
      x: xGrid - st.labelColW + 2,
      y: yRowCenter - 3,
      size: 8,
      font: st.font,
      color: st.textColor,
    });
  }
  for (let c = 0; c < colCount; c++) {
    const cx = round10(xGrid + c * spacing + spacing / 2);
    drawBubble(page, cx, yRowCenter, st.bubbleSize, st.lineColor, 1);
  }
}

/** Ogrenici no: 0-9 ust baslik, H1-H5 satir etiketi */
function drawStudentNoGrid(
  page: PdfDrawPage,
  xLeft: number,
  yTop: number,
  numDigits: number,
  st: CodeBubbleStyle,
) {
  const digitLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const xGrid = xLeft + st.labelColW;
  const gridW = 10 * st.choiceSpacing;
  let y = yTop;

  drawChoiceHeaderRow(page, xGrid, y, digitLabels, st.choiceSpacing, st);
  y -= st.headerH;

  const rowsTop = y;
  for (let r = 0; r < numDigits; r++) {
    const rowCenterY = rowsTop - r * st.rowHeight - st.rowHeight / 2;
    if (r > 0) {
      page.drawLine({
        start: { x: xLeft, y: rowsTop - r * st.rowHeight },
        end: { x: xLeft + st.labelColW + gridW + 4, y: rowsTop - r * st.rowHeight },
        thickness: 0.2,
        color: st.rowLine,
      });
    }
    drawChoiceBubbleRow(page, xGrid, rowCenterY, 10, st.choiceSpacing, st, `H${r + 1}`, r % 2 === 1);
  }
  page.drawLine({
    start: { x: xLeft, y: rowsTop - numDigits * st.rowHeight },
    end: { x: xLeft + st.labelColW + gridW + 4, y: rowsTop - numDigits * st.rowHeight },
    thickness: 0.2,
    color: st.rowLine,
  });
}

/** Kitapcik / sinif: sol etiket + secenek adlari ustte, balon altta */
function drawCodeBubbleField(
  page: PdfDrawPage,
  x0: number,
  yTop: number,
  fieldWidth: number,
  fieldLabelColW: number,
  fieldLabel: string,
  choiceLabels: string[],
  cols: number,
  st: CodeBubbleStyle,
) {
  const rows = Math.ceil(choiceLabels.length / cols);
  const xGrid = x0 + fieldLabelColW;
  const gridW = fieldWidth - fieldLabelColW - 4;
  const spacing = Math.max(st.choiceSpacing, gridW / cols);
  const blockH = rows * (st.headerH + st.rowHeight);
  const yBottom = yTop - blockH;

  page.drawRectangle({
    x: x0,
    y: yBottom,
    width: fieldLabelColW - 2,
    height: blockH,
    color: rgb(1, 1, 1),
  });

  for (let row = 0; row < rows; row++) {
    const slice = choiceLabels.slice(row * cols, row * cols + cols);
    const rowTop = yTop - row * (st.headerH + st.rowHeight);
    drawChoiceHeaderRow(page, xGrid, rowTop, slice, spacing, st);
    const rowCenterY = rowTop - st.headerH - st.rowHeight / 2;
    drawChoiceBubbleRow(page, xGrid, rowCenterY, slice.length, spacing, st, null, row % 2 === 1);
    if (row < rows - 1) {
      page.drawLine({
        start: { x: xGrid, y: rowTop - st.headerH - st.rowHeight },
        end: { x: x0 + fieldWidth, y: rowTop - st.headerH - st.rowHeight },
        thickness: 0.2,
        color: st.rowLine,
      });
    }
  }

  const labelY =
    rows > 1 ? yTop - blockH / 2 - 3 : yTop - st.headerH / 2 - 3;
  page.drawText(fieldLabel, {
    x: x0 + 2,
    y: labelY,
    size: 8,
    font: st.fontBold,
    color: st.textColor,
  });

  return yBottom - 4;
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
      drawBubble(page, cx, cy, bubbleSize, lineColor, 1);
    }
  }
}

/**
 * PWA OMR perspektif düzeltme — köşe konumları/ölçüleri değiştirmeyin.
 * Beyaz halo: baskı/gölgede siyah kare daha net bulunur.
 */
const OMR_ANCHOR_SIZE = 7;
const OMR_ANCHOR_INSET = 10;

function drawAnchorMarkers(
  page: { drawRectangle: (o: object) => void },
  pageWidth: number,
  pageHeight: number,
  margin: number,
) {
  const marker = OMR_ANCHOR_SIZE;
  const inset = OMR_ANCHOR_INSET;
  const black = rgb(0, 0, 0);
  const halo = rgb(1, 1, 1);
  const corners: Array<{ x: number; y: number }> = [
    { x: margin - inset, y: pageHeight - margin + inset - marker },
    { x: pageWidth - margin + inset - marker, y: pageHeight - margin + inset - marker },
    { x: margin - inset, y: margin - inset },
    { x: pageWidth - margin + inset - marker, y: margin - inset },
  ];
  for (const c of corners) {
    page.drawRectangle({ x: c.x - 1, y: c.y - 1, width: marker + 2, height: marker + 2, color: halo });
    page.drawRectangle({ x: c.x, y: c.y, width: marker, height: marker, color: black });
  }
}

/** Sol hizalama şeridi — OMR satır senkronu (PWA; yalnızca sol) */
function drawAlignmentStrip(
  page: { drawRectangle: (o: object) => void },
  pageHeight: number,
  margin: number,
  stripWidth: number,
  stripColor: ReturnType<typeof rgb>,
  tickColor: ReturnType<typeof rgb>,
) {
  const stripH = pageHeight - 2 * margin;
  page.drawRectangle({ x: 0, y: margin, width: stripWidth, height: stripH, color: stripColor });
  const tickCount = Math.floor(stripH / 28);
  for (let i = 0; i < tickCount; i++) {
    const sy = margin + 12 + i * 28;
    page.drawRectangle({ x: 2, y: sy, width: stripWidth - 4, height: 2, color: tickColor });
  }
}

function drawBubble(
  page: { drawCircle: (o: object) => void },
  cx: number,
  cy: number,
  size: number,
  borderColor: ReturnType<typeof rgb>,
  borderWidth = 1,
) {
  page.drawCircle({
    x: round10(cx),
    y: round10(cy),
    size,
    borderColor,
    borderWidth,
  });
}

/** Test blogu – LGS/YKS coklu ders */
interface TestBlock {
  label: string;
  questionCount: number;
  choiceCount: number;
}

/** DB’den gelen test_blocks bazen eksik sayı içerir; NaN / boş dizi PDF’de 500 üretir */
function normalizeTestBlocks(blocks: TestBlock[]): TestBlock[] {
  const raw = Array.isArray(blocks) ? blocks : [];
  const out: TestBlock[] = [];
  for (const b of raw) {
    const qc = Number((b as TestBlock).questionCount);
    const cc = Number((b as TestBlock).choiceCount);
    const q = Math.max(1, Math.min(200, Number.isFinite(qc) ? qc : 20));
    const c = Math.max(1, Math.min(6, Number.isFinite(cc) ? cc : 5));
    const label = String((b as TestBlock).label ?? 'CEVAPLAR').trim() || 'CEVAPLAR';
    out.push({ label, questionCount: q, choiceCount: c });
  }
  if (out.length === 0) {
    return [{ label: 'CEVAPLAR', questionCount: 20, choiceCount: 5 }];
  }
  return out;
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

/** Modern optik form PDF — OMR alanı tarayıcı/PWA kamera ile uyumlu */
@Injectable()
export class OptikFormPdfService {
  private readonly A4_WIDTH = 595.28;
  private readonly A4_HEIGHT = 841.89;
  /** PWA OMR ile paylaşılan sayfa kenarı */
  private readonly MARGIN = 40;
  private readonly FOOTER_H = 28;
  private readonly ALIGN_STRIP_W = 8;
  private readonly CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
  private readonly OMR_LAYOUT_VERSION = 'omr-v3';

  /** Baskı + kamera: OMR alanı beyaz/siyah; renk üst bant ve başlıklarda */
  private readonly PAGE_BG = rgb(1, 1, 1);
  private readonly ACCENT = rgb(0.0, 0.42, 0.5);
  private readonly ACCENT_LINE = rgb(0.95, 0.55, 0.12);
  private readonly SECTION_BG = rgb(0.9, 0.96, 0.97);
  private readonly BUBBLE_BORDER = rgb(0, 0, 0);
  private readonly HEADER_COLOR = rgb(0.08, 0.11, 0.15);
  private readonly ALIGN_STRIP = rgb(0.07, 0.09, 0.12);
  private readonly ALIGN_TICK = rgb(0.78, 0.8, 0.84);
  private readonly BORDER_COLOR = rgb(0.82, 0.84, 0.87);
  private readonly TEXT_PRIMARY = rgb(0.1, 0.11, 0.14);
  private readonly TEXT_MUTED = rgb(0.4, 0.43, 0.48);
  private readonly ROW_ALT = rgb(0.975, 0.978, 0.982);
  private readonly SCAN_TIP_BG = rgb(0.94, 0.95, 0.96);
  private readonly ROW_LINE = rgb(0.9, 0.91, 0.93);

  async generatePdf(
    template: OptikFormTemplate | Record<string, unknown>,
    options?: { prependBlank?: number },
  ): Promise<Buffer> {
    const prependBlank = Math.min(5, Math.max(0, options?.prependBlank ?? 0));
    const expectedPages = prependBlank + 1;
    const formDoc = await this.buildSinglePageFormDocument(template);
    this.assertSinglePage(formDoc, 'form');

    const contentPageIndex = this.getContentPageIndex(formDoc);

    if (prependBlank === 0) {
      return this.rebuildPdfWithPages(formDoc, [contentPageIndex]);
    }

    const merged = await PDFDocument.create();
    this.clearAllPages(merged);
    const w = this.A4_WIDTH;
    const h = this.A4_HEIGHT;
    for (let i = 0; i < prependBlank; i++) {
      merged.addPage([w, h]);
    }
    const copiedPages = await merged.copyPages(formDoc, [contentPageIndex]);
    merged.addPage(copiedPages[0]!);
    return this.rebuildPdfWithPages(merged, Array.from({ length: expectedPages }, (_, i) => i));
  }

  /** pdf-lib bos sayfa birakirsa icerik son sayfada kalir */
  private getContentPageIndex(doc: PDFDocument): number {
    const n = doc.getPageCount();
    if (n < 1) throw new Error('[OptikFormPdf] Form sayfasi yok');
    return n - 1;
  }

  /** Kaynak PDF’den yalnizca secilen sayfalari yeni tek dokumana kopyalar */
  private async rebuildPdfWithPages(source: PDFDocument, pageIndices: number[]): Promise<Buffer> {
    const out = await PDFDocument.create();
    this.clearAllPages(out);
    const copied = await out.copyPages(source, pageIndices);
    for (const p of copied) {
      out.addPage(p);
    }
    if (out.getPageCount() !== pageIndices.length) {
      throw new Error(
        `[OptikFormPdf] Yeniden olusturma hatasi: beklenen ${pageIndices.length}, bulunan ${out.getPageCount()}`,
      );
    }
    return Buffer.from(await out.save({ addDefaultPage: false }));
  }

  private clearAllPages(doc: PDFDocument): void {
    while (doc.getPageCount() > 0) {
      doc.removePage(0);
    }
  }

  private assertSinglePage(doc: PDFDocument, label: string): void {
    const n = doc.getPageCount();
    if (n !== 1) {
      throw new Error(`[OptikFormPdf] ${label}: beklenen 1 sayfa, bulunan ${n}`);
    }
  }

  /** Tek sayfa optik formu (bos yazili sayfasi yok); prepend icin generatePdf copyPages kullanir */
  private async buildSinglePageFormDocument(
    template: OptikFormTemplate | Record<string, unknown>,
  ): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    this.clearAllPages(doc);
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
      blocks = normalizeTestBlocks(t.roiConfig.test_blocks as TestBlock[]);
    } else if (t.gradeLevel === 'LGS' || /^lgs/i.test(String(t.slug ?? ''))) {
      blocks = [...LGS_BLOCKS];
    } else if ((t.gradeLevel === 'YKS' || /^yks/i.test(String(t.slug ?? ''))) && /tyt|120/i.test(String(t.slug ?? ''))) {
      blocks = [...YKS_TYT_BLOCKS];
    } else {
      const q = Math.max(1, Number(t.questionCount) || 20);
      const c = Math.max(1, Math.min(Number(t.choiceCount) || 5, 6));
      blocks = [{ label: 'CEVAPLAR', questionCount: q, choiceCount: c }];
    }
    blocks = normalizeTestBlocks(blocks);
    const questionCount = blocks.reduce((s, b) => s + b.questionCount, 0);

    const page = doc.addPage([pageWidth, pageHeight]);
    this.assertSinglePage(doc, 'build');
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: this.PAGE_BG });
    let y = pageHeight - margin;

    drawAnchorMarkers(page, pageWidth, pageHeight, margin);
    drawAlignmentStrip(page, pageHeight, margin, this.ALIGN_STRIP_W, this.ALIGN_STRIP, this.ALIGN_TICK);

    const headerHeight = 40;
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight,
      width: pageWidth,
      height: headerHeight,
      color: this.ACCENT,
    });
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight,
      width: pageWidth,
      height: 4,
      color: this.ACCENT_LINE,
    });
    page.drawText(txt('CEVAP KAĞIDI'), {
      x: margin + this.ALIGN_STRIP_W + 4,
      y: pageHeight - headerHeight + 14,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    const nameW = font.widthOfTextAtSize(txt(name), 11);
    page.drawText(txt(name), {
      x: Math.max(margin + this.ALIGN_STRIP_W + 4, pageWidth - margin - nameW - 4),
      y: pageHeight - headerHeight + 15,
      size: 11,
      font,
      color: rgb(0.88, 0.93, 0.96),
    });
    page.drawText(txt(`${questionCount} soru`), {
      x: margin + this.ALIGN_STRIP_W + 4,
      y: pageHeight - headerHeight + 4,
      size: 8,
      font,
      color: rgb(0.65, 0.75, 0.82),
    });
    y -= headerHeight + 18;

    const contentX = margin + this.ALIGN_STRIP_W + 12;
    const contentW = pageWidth - margin - contentX;
    const cardPad = 16;
    const cardInnerX = contentX + cardPad;
    const cardInnerW = contentW - 2 * cardPad;
    // CEVAPLAR ile ayni satir yuksekligi ve bubble boyutu
    const idRowHeight = 11;
    const idBubbleSize = 4;
    const idMinChoiceSpacing = 2 * idBubbleSize + 3.5;
    const idOptionHeaderH = 10;
    const idDigitRows = 5;
    const idLabelColW = 20;
    const codeSt: CodeBubbleStyle = {
      bubbleSize: idBubbleSize,
      rowHeight: idRowHeight,
      headerH: idOptionHeaderH,
      labelColW: idLabelColW,
      choiceSpacing: idMinChoiceSpacing,
      lineColor: this.BUBBLE_BORDER,
      headerBg: this.SECTION_BG,
      rowAlt: this.ROW_ALT,
      rowLine: this.ROW_LINE,
      font,
      fontBold,
      textColor: this.TEXT_PRIMARY,
      labelColor: this.TEXT_MUTED,
    };

    // —— Öğrenci bilgileri kartı: 2 sütun ——
    const idColGap = 12;
    const idColW = (cardInnerW - idColGap) / 2;
    const idFieldLabelW = 72;
    const cardHeaderH = 22;
    const kitapcikBlockH = idOptionHeaderH + idRowHeight;
    const sinifBlockH = 2 * (idOptionHeaderH + idRowHeight);
    const leftColBodyH = 3 * idRowHeight + kitapcikBlockH + sinifBlockH + 12;
    const rightColBodyH = idOptionHeaderH + idDigitRows * idRowHeight + 14;
    const cardBodyH = Math.max(leftColBodyH, rightColBodyH) + 8;
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
      color: this.SECTION_BG,
      borderWidth: 0,
    });
    page.drawLine({
      start: { x: topBlockX, y: topBlockY - cardHeaderH },
      end: { x: topBlockX + 3, y: topBlockY - cardHeaderH },
      thickness: 2,
      color: this.ACCENT_LINE,
    });
    page.drawText(txt('ÖĞRENCİ BİLGİLERİ'), {
      x: cardInnerX,
      y: topBlockY - cardHeaderH + 7,
      size: 10,
      font: fontBold,
      color: this.TEXT_PRIMARY,
    });

    const colDivX = cardInnerX + idColW + idColGap / 2;
    page.drawLine({
      start: { x: colDivX, y: topBlockY - cardHeaderH },
      end: { x: colDivX, y: cardBottom },
      thickness: 0.4,
      color: this.BORDER_COLOR,
    });

    const leftLineLabels = ['Adı / Soyadı', 'Testin Adı', 'Sınav Tarihi'];
    const leftValX = cardInnerX + idFieldLabelW;
    let leftRowTop = topBlockY - cardHeaderH - 8;

    for (let idx = 0; idx < leftLineLabels.length; idx++) {
      const rowBottom = leftRowTop - idRowHeight;
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: cardInnerX,
          y: rowBottom,
          width: idColW,
          height: idRowHeight,
          color: this.ROW_ALT,
        });
      }
      page.drawLine({
        start: { x: cardInnerX, y: leftRowTop },
        end: { x: cardInnerX + idColW, y: leftRowTop },
        thickness: 0.2,
        color: this.ROW_LINE,
      });
      const rowCenterY = leftRowTop - idRowHeight / 2;
      page.drawText(txt(leftLineLabels[idx]!), {
        x: cardInnerX + 2,
        y: rowCenterY - 3,
        size: 8,
        font: fontBold,
        color: this.TEXT_MUTED,
      });
      page.drawLine({
        start: { x: leftValX, y: rowCenterY - 4 },
        end: { x: cardInnerX + idColW - 4, y: rowCenterY - 4 },
        thickness: 0.5,
        color: this.BORDER_COLOR,
      });
      leftRowTop -= idRowHeight;
    }

    leftRowTop = drawCodeBubbleField(
      page,
      cardInnerX,
      leftRowTop,
      idColW - 4,
      idFieldLabelW,
      txt('Kitapçık'),
      ['A', 'B'],
      2,
      codeSt,
    );
    leftRowTop = drawCodeBubbleField(
      page,
      cardInnerX,
      leftRowTop,
      idColW - 4,
      idFieldLabelW,
      txt('Sınıf'),
      ['5', '6', '7', '8', '9', '10', '11', '12'],
      4,
      codeSt,
    );

    page.drawLine({
      start: { x: cardInnerX, y: cardBottom + 8 },
      end: { x: cardInnerX + idColW, y: cardBottom + 8 },
      thickness: 0.2,
      color: this.ROW_LINE,
    });

    const rightColX = colDivX + idColGap / 2;
    const digitChoiceSpacing = Math.max(idMinChoiceSpacing, (idColW - idLabelColW - 12) / 10);
    const digitBlockTop = topBlockY - cardHeaderH - 8;
    page.drawText(txt('Öğrenci kodu (5 hane)'), {
      x: rightColX,
      y: digitBlockTop,
      size: 8,
      font: fontBold,
      color: this.TEXT_PRIMARY,
    });
    drawStudentNoGrid(page, rightColX, round10(digitBlockTop - 6), idDigitRows, {
      ...codeSt,
      labelColW: idLabelColW,
      choiceSpacing: digitChoiceSpacing,
    });

    y = cardBottom - 12;

    // Cevap alanı tek sayfaya sığacak dinamik grid
    const cevaplarX = contentX;
    const cevaplarWidth = contentW;
    const sectionHeight = 20;
    const blockHeaderH = 14;
    const optionHeaderH = 10;
    const colGap = 8;

    // Soru yoğunluğuna göre sütun sayısı
    let numCols = questionCount >= 100 ? 5 : questionCount >= 70 ? 4 : questionCount >= 35 ? 3 : 2;
    const maxChoiceCount = Math.max(1, ...blocks.map((b) => Math.max(1, Math.min(6, b.choiceCount))));
    const minBubbleSize = 3.8;
    const minChoiceSpacing = 2 * minBubbleSize + 3;
    while (numCols > 2) {
      const qw = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
      const minCellW = 18 + maxChoiceCount * minChoiceSpacing + 8;
      if (qw >= minCellW) break;
      numCols -= 1;
    }

    const totalRows = blocks.reduce((s, b) => s + Math.ceil(b.questionCount / numCols), 0);
    const fixedH = sectionHeight + blocks.length * (blockHeaderH + optionHeaderH + 8) + 10;
    const availableH = Math.max(140, y - margin - this.FOOTER_H - 8);
    const rowHeight = Math.max(9, Math.min(12, Math.floor((availableH - fixedH) / Math.max(1, totalRows))));
    const answerBubble = Math.max(3.6, Math.min(4.8, rowHeight * 0.36));
    const answerAreaTopY = y;
    const questionWidth = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
    const numberW = 18;
    const innerPad = 8;

    page.drawRectangle({
      x: cevaplarX, y: y - sectionHeight, width: cevaplarWidth, height: sectionHeight, color: this.SECTION_BG,
    });
    page.drawLine({
      start: { x: cevaplarX, y: y - sectionHeight },
      end: { x: cevaplarX + 3, y: y - sectionHeight },
      thickness: 2,
      color: this.ACCENT_LINE,
    });
    page.drawText(txt('CEVAPLAR'), { x: cevaplarX + 12, y: y - 14, size: 10, font: fontBold, color: this.TEXT_PRIMARY });
    y -= sectionHeight + 10;

    for (const blk of blocks) {
      const blkChoiceCount = Math.max(1, Math.min(blk.choiceCount, 6));
      const rowsPerCol = Math.ceil(blk.questionCount / numCols);
      const blockBodyH = rowsPerCol * rowHeight;

      // Ders başlığı (tek blok CEVAPLAR ise tekrar başlık çizme)
      if ((blk.label || '').toLocaleUpperCase('tr-TR') !== 'CEVAPLAR') {
        page.drawRectangle({
          x: cevaplarX, y: y - blockHeaderH, width: cevaplarWidth, height: blockHeaderH, color: this.SECTION_BG,
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
            color: this.ROW_ALT,
          });
        }
        page.drawLine({
          start: { x: cevaplarX, y: rowsTop - r * rowHeight },
          end: { x: cevaplarX + cevaplarWidth, y: rowsTop - r * rowHeight },
          thickness: 0.2,
          color: this.ROW_LINE,
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
          drawBubble(page, cx, rowCenterY, answerBubble, this.BUBBLE_BORDER, 1);
        }
      }

      y -= blockBodyH + 8;
    }

    const answerAreaBottomY = y;
    page.drawRectangle({
      x: cevaplarX - 6,
      y: answerAreaBottomY - 4,
      width: cevaplarWidth + 12,
      height: answerAreaTopY - answerAreaBottomY + 10,
      borderColor: this.BUBBLE_BORDER,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: contentX,
      y: margin + 4,
      width: contentW,
      height: this.FOOTER_H - 4,
      color: this.SCAN_TIP_BG,
      borderColor: this.BORDER_COLOR,
      borderWidth: 0.5,
    });
    page.drawText(txt('Telefon/PWA: Dört köşe karesi ve yan şeritler kadraja girsin; formu düz, iyi ışıkta tutun.'), {
      x: contentX + 8,
      y: margin + 16,
      size: 7,
      font,
      color: this.TEXT_MUTED,
    });
    page.drawText(txt('Koyu kurşun kalem ile doldurun; her soruda yalnızca bir şık.'), {
      x: contentX + 8,
      y: margin + 8,
      size: 7,
      font,
      color: this.TEXT_MUTED,
    });
    page.drawText(this.OMR_LAYOUT_VERSION, {
      x: pageWidth - margin - 36,
      y: margin + 6,
      size: 6,
      font,
      color: rgb(0.75, 0.78, 0.82),
    });

    return doc;
  }
}
