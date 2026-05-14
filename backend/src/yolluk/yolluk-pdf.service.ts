import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  bildirimYerDisplay,
  buildSurekliPdfRows,
  yevmiyePayiDisplayText,
  yollukRatesFromSnapshot,
  type EkGostergeBand,
  type GeciciBildirimComputed,
  type GeciciBildirimRowComputed,
  type GeciciBildirimRowInput,
  type GeciciInputs,
  type SurekliPdfRow,
} from './yolluk-calculator.engine';
import { parseCalcInput } from './yolluk-input.validation';

function fmtTrTl(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** PDF için bildirim_meta — kayıtta bazen ham yapı; parse ile sunucu ile aynı alanlar */
function surekliBildirimMetaFromInputs(inp: Record<string, unknown>): Record<string, unknown> {
  try {
    const parsed = parseCalcInput({ ...inp, kind: 'surekli' });
    if (parsed.kind === 'surekli' && parsed.bildirim_meta) {
      return { ...(parsed.bildirim_meta as Record<string, unknown>) };
    }
  } catch {
    /* ham inputs */
  }
  const raw = inp.bildirim_meta ?? inp['bildirimMeta'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function metaScalar(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  return s;
}

/** bildirim_meta.pdf_duzenleme_tarihi — YYYY-MM-DD veya Gün.Ay.Yıl */
function surekliPdfDocDateFromMeta(meta: Record<string, unknown>): Date | null {
  const raw = metaScalar(meta.pdf_duzenleme_tarihi) || metaScalar(meta['pdfDuzenlemeTarihi']);
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const y = +iso[1];
    const mo = +iso[2] - 1;
    const da = +iso[3];
    const d = new Date(y, mo, da);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === da ? d : null;
  }
  const tr = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  if (tr) {
    const da = +tr[1];
    const mo = +tr[2] - 1;
    const y = +tr[3];
    const d = new Date(y, mo, da);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === da ? d : null;
  }
  return null;
}

function bildirimPdfDateToTrDisplay(raw: string): string {
  const d = surekliPdfDocDateFromMeta({ pdf_duzenleme_tarihi: raw });
  if (!d) return raw.trim().slice(0, 24);
  const da = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${da}.${mo}.${d.getFullYear()}`;
}

/** Türkçe ek öncesi kesme (’ U+2019); düz tırnak (') ile karışmaz */
const TR_APOST = '\u2019';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function truncateTextToWidth(font: PDFFont, text: string, size: number, maxW: number): string {
  const t = text.trim();
  if (!t) return '';
  const ell = '…';
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 0 && font.widthOfTextAtSize(`${s}${ell}`, size) > maxW) s = s.slice(0, -1);
  return s ? `${s}${ell}` : ell;
}

/** «Okul müdürü (Ad Soyad)» → ünvan + ad */
function parseBirimYetkilisi(raw: string): { unvanText: string; adText: string } {
  const t = raw.trim();
  const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { unvanText: m[1]!.trim() || 'Okul müdürü', adText: m[2]!.trim() };
  }
  if (t) return { unvanText: t, adText: '' };
  return { unvanText: 'Okul müdürü', adText: '' };
}

function drawHLine(
  page: {
    drawLine: (o: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      thickness: number;
      color: ReturnType<typeof rgb>;
    }) => void;
  },
  x1: number,
  x2: number,
  y: number,
  stroke: ReturnType<typeof rgb>,
) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.45, color: stroke });
}

function drawVLine(
  page: {
    drawLine: (o: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      thickness: number;
      color: ReturnType<typeof rgb>;
    }) => void;
  },
  x: number,
  y1: number,
  y2: number,
  stroke: ReturnType<typeof rgb>,
) {
  page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: 0.45, color: stroke });
}

function drawRect(
  page: {
    drawLine: (o: {
      start: { x: number; y: number };
      end: { x: number; y: number };
      thickness: number;
      color: ReturnType<typeof rgb>;
    }) => void;
  },
  x: number,
  yTop: number,
  w: number,
  h: number,
  stroke: ReturnType<typeof rgb>,
) {
  const yBot = yTop - h;
  drawHLine(page, x, x + w, yTop, stroke);
  drawHLine(page, x, x + w, yBot, stroke);
  drawVLine(page, x, yBot, yTop, stroke);
  drawVLine(page, x + w, yBot, yTop, stroke);
}

type PdfFont = PDFFont;

function drawTextCentered(
  page: PDFPage,
  text: string,
  cx: number,
  yMid: number,
  cw: number,
  size: number,
  font: PdfFont,
  color: ReturnType<typeof rgb>,
) {
  const tw = font.widthOfTextAtSize(text, size);
  const tx = cx + Math.max(0, (cw - tw) / 2);
  page.drawText(text, { x: tx, y: yMid - size * 0.35, size, font, color });
}

/** Tek satır: kutuya göre punto küçültme + yatay/dikey ortalı (PDF y: büyük = yukarı) */
function drawTextFittedInRect(
  page: PDFPage,
  font: PdfFont,
  text: string,
  xLeft: number,
  yTopPdf: number,
  yBotPdf: number,
  cw: number,
  maxSize: number,
  minSize: number,
  color: ReturnType<typeof rgb>,
) {
  const t = text.trim();
  if (!t) return;
  const yHi = Math.max(yTopPdf, yBotPdf);
  const yLo = Math.min(yTopPdf, yBotPdf);
  const cellH = Math.max(0.5, yHi - yLo);
  const padX = 1.5;
  const maxW = Math.max(3, cw - padX * 2);
  let size = Math.min(maxSize, cellH / 1.42);
  size = Math.max(minSize, Math.floor(size * 4) / 4);
  let guard = 0;
  while (guard++ < 120 && size > minSize) {
    if (font.widthOfTextAtSize(t, size) <= maxW && size * 1.15 <= cellH) break;
    size -= 0.25;
  }
  const tw = font.widthOfTextAtSize(t, size);
  const tx = xLeft + Math.max(padX, (cw - tw) / 2);
  const mid = (yHi + yLo) / 2;
  const baselineY = mid - size * 0.38;
  page.drawText(t, { x: tx, y: baselineY, size, font, color });
}

function drawLinesCenteredInBand(
  page: PDFPage,
  lines: string[],
  xa: number,
  yTop: number,
  yBot: number,
  cw: number,
  maxSize: number,
  font: PdfFont,
  color: ReturnType<typeof rgb>,
  minSize = 3.25,
) {
  const linesF = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (!linesF.length) return;
  const yHi = Math.max(yTop, yBot);
  const yLo = Math.min(yTop, yBot);
  const cellH = Math.max(0.5, yHi - yLo);
  const padX = 1.5;
  const maxW = Math.max(3, cw - padX * 2);
  const lineGap = 1.15;
  let size = maxSize;
  const lineH = () => size + lineGap;
  let iter = 0;
  while (iter++ < 120 && size > minSize) {
    const lh = lineH();
    const tot = linesF.length * lh;
    const wOk = linesF.every((ln) => font.widthOfTextAtSize(ln, size) <= maxW);
    const hOk = tot <= cellH - 0.2;
    if (wOk && hOk) break;
    size -= 0.25;
  }
  const lh = lineH();
  const total = linesF.length * lh;
  const mid = (yHi + yLo) / 2;
  const firstBaseline = mid + ((linesF.length - 1) * lh) / 2 - size * 0.38;
  linesF.forEach((s, i) => {
    const tw = font.widthOfTextAtSize(s, size);
    const tx = xa + Math.max(padX, (cw - tw) / 2);
    page.drawText(s, { x: tx, y: firstBaseline - i * lh, size, font, color });
  });
}

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

export interface YollukOfficialPdfInput {
  schoolName: string;
  teacherName: string;
  preparerName: string;
  /** Hesap; bildirimde yoksa PDF anında öğretmen profilinden */
  teacherIban?: string | null;
  /** Belge müdür adı (+ PDF servisi okul müdürü yedeği) */
  mudur_adi_belge?: string | null;
  calculation: {
    id: string;
    kind: string;
    status: string;
    title: string | null;
    created_at: Date;
    finalized_at: Date | null;
    archived_at?: Date | null;
    inputs: Record<string, unknown>;
    result: {
      total_tl?: number;
      effective_daily_tl?: number;
      lines?: Array<{ key: string; label: string; amount_tl: number }>;
      gecici_bildirim?: GeciciBildirimComputed;
      surekli_pdf?: { rows: SurekliPdfRow[] };
    };
    rules_snapshot: Record<string, unknown>;
  };
}

@Injectable()
export class YollukPdfService {
  async buildOfficialReportPdf(data: YollukOfficialPdfInput): Promise<Buffer> {
    const c = data.calculation;
    const gb = c.result?.gecici_bildirim;
    if (c.kind === 'gecici' && gb?.rows?.length) {
      return this.buildGeciciBildirimPdf(data, gb);
    }
    if (c.kind === 'surekli') {
      let surekliRows = c.result?.surekli_pdf?.rows;
      if (!Array.isArray(surekliRows) || surekliRows.length === 0) {
        try {
          const inp = parseCalcInput({ ...c.inputs, kind: 'surekli' });
          if (inp.kind === 'surekli') {
            surekliRows = buildSurekliPdfRows(yollukRatesFromSnapshot(c.rules_snapshot), inp);
          }
        } catch {
          surekliRows = undefined;
        }
      }
      if (Array.isArray(surekliRows) && surekliRows.length > 0) {
        return this.buildSurekliBildirimPdf(data, surekliRows);
      }
    }
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const pageW = 595;
    const pageH = 842;
    const margin = 48;
    const maxW = pageW - margin * 2;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const fmt = (d: Date) =>
      d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    };

    const title = (t: string, size = 14) => {
      if (y < margin + 80) newPage();
      page.drawText(t, { x: margin, y, size, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
      y -= size + 10;
    };

    const preChunk = (s: string, n: number) => {
      const parts: string[] = [];
      for (let i = 0; i < s.length; i += n) parts.push(s.slice(i, i + n));
      return parts.join('\n');
    };

    const wrapLines = (text: string, size: number): string[] => {
      const out: string[] = [];
      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
          else {
            if (line) out.push(line);
            line = w;
          }
        }
        if (line) out.push(line);
        if (words.length === 0) out.push('');
      }
      return out.length ? out : [''];
    };

    const body = (text: string, size = 10) => {
      const lines = wrapLines(text, size);
      const lh = size + 3;
      for (const ln of lines) {
        if (y < margin + lh) newPage();
        page.drawText(ln, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.2) });
        y -= lh;
      }
      y -= 4;
    };

    const wrapLinesW = (text: string, size: number, width: number): string[] => {
      const out: string[] = [];
      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) <= width) line = test;
          else {
            if (line) out.push(line);
            line = w;
          }
        }
        if (line) out.push(line);
        if (words.length === 0) out.push('');
      }
      return out.length ? out : [''];
    };

    const row2 = (a: string, b: string, size = 9) => {
      const colX = margin + 150;
      const colW = maxW - 150;
      const bLines = wrapLinesW(b, size, colW);
      const lh = size + 4;
      const blockH = Math.max(lh, bLines.length * lh);
      if (y < margin + blockH + 8) newPage();
      page.drawText(a, { x: margin, y, size, font: fontBold, color: rgb(0.2, 0.2, 0.25) });
      let yy = y;
      for (const ln of bLines) {
        page.drawText(ln, { x: colX, y: yy, size, font, color: rgb(0.15, 0.15, 0.2) });
        yy -= lh;
      }
      y -= Math.max(lh + 4, bLines.length * lh + 4);
    };

    title('Yurt içi yolluk hesap raporu (özet)');
    body(
      'Bu belge bilgi amaçlı özet rapordur. Ödeme ve kesin haklar için kurumunuzun mali işler birimi ve 6245 sayılı Harcırah Kanunu ile ilgili mevzuat esas alınır.',
      9,
    );

    row2('Okul:', data.schoolName || '—');
    row2('Rapor tarihi:', fmt(new Date()));
    row2('Kayıt no:', c.id);
    row2('Durum:', c.status === 'final' ? 'Kesinleşti' : 'Taslak');
    row2(
      'Hesap türü:',
      c.kind === 'gecici'
        ? 'Yurt içi geçici görev yolluğu (özet)'
        : c.kind === 'denetim'
          ? 'Denetim elemanı yolluğu (özet)'
          : 'Yurt içi sürekli görev — yer değiştirme yolluğu (özet)',
    );
    if (c.title?.trim()) row2('Başlık:', c.title.trim());
    row2('Oluşturulma:', fmt(new Date(c.created_at)));
    if (c.finalized_at) row2('Kesinleşme:', fmt(new Date(c.finalized_at)));
    row2('Öğretmen:', data.teacherName || '—');
    row2('Hazırlayan:', data.preparerName || '—');

    y -= 6;
    title('Parametre özeti (anlık görüntü)', 11);
    body(preChunk(JSON.stringify(c.rules_snapshot, null, 2), 72), 8);

    y -= 4;
    title('Girdiler', 11);
    body(preChunk(JSON.stringify(c.inputs, null, 2), 72), 8);

    y -= 4;
    title('Hesap satırları', 11);
    const eff = (c.result as { effective_daily_tl?: number })?.effective_daily_tl;
    if (eff != null && Number.isFinite(eff)) {
      row2('Kullanılan gündelik (iç yevmiye)', `${eff.toFixed(2)} TL`, 9);
    }
    for (const line of c.result?.lines ?? []) {
      row2(line.label, `${line.amount_tl.toFixed(2)} TL`, 9);
    }
    y -= 4;
    row2('GENEL TOPLAM', `${(c.result?.total_tl ?? 0).toFixed(2)} TL`, 11);

    y -= 14;
    const stLine = rgb(0.2, 0.2, 0.22);
    const lblInk = rgb(0.22, 0.22, 0.26);
    if (y < margin + 120) newPage();
    page.drawText('Onay — imza ve tarih (elle doldurulur)', {
      x: margin,
      y,
      size: 10.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.14),
    });
    y -= 14;
    const ySig = y;
    const splitPdf = margin + maxW * 0.46;
    const s9 = 9;
    const drawSigCol = (x0: number, x1: number) => {
      let yy = ySig;
      page.drawText('İmza :', { x: x0, y: yy, size: s9, font: fontBold, color: lblInk });
      drawHLine(page, x0 + 38, x1, yy - 1, stLine);
      yy -= 13;
      const t2 = 'İmza tarihi (gün / ay / yıl) :';
      page.drawText(t2, { x: x0, y: yy, size: s9, font: fontBold, color: lblInk });
      drawHLine(page, x0 + fontBold.widthOfTextAtSize(t2, s9) + 4, x1, yy - 1, stLine);
    };
    drawSigCol(margin, splitPdf - 8);
    drawSigCol(splitPdf + 8, margin + maxW);
    y = ySig - 32;
    if (y < margin + 48) newPage();
    const dv = 'Özet bilgilerde veri değişikliği bulunmaktadır';
    page.drawText(`${dv}:`, { x: margin, y, size: 9, font: fontBold, color: rgb(0.12, 0.12, 0.14) });
    let xx = margin + fontBold.widthOfTextAtSize(`${dv}:`, 9) + 10;
    const bz = 8;
    const yBoxT = y + 2;
    drawRect(page, xx, yBoxT, bz, bz, stLine);
    page.drawText('Evet', { x: xx + bz + 4, y, size: 9, font, color: rgb(0.15, 0.15, 0.2) });
    xx += bz + 4 + font.widthOfTextAtSize('Evet', 9) + 14;
    drawRect(page, xx, yBoxT, bz, bz, stLine);
    page.drawText('Hayır', { x: xx + bz + 4, y, size: 9, font, color: rgb(0.15, 0.15, 0.2) });
    y -= 22;

    y -= 8;
    body(`Kural sürümü (kayıt): ${String(c.rules_snapshot?.rules_version ?? '—')}`, 8);

    const pdf = await doc.save();
    return Buffer.from(pdf);
  }

  private async buildSurekliBildirimPdf(data: YollukOfficialPdfInput, rows: SurekliPdfRow[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    const stroke = rgb(0, 0, 0);
    const ink = rgb(0, 0, 0);
    const muted = rgb(0.2, 0.2, 0.22);
    const PH = 595.2;
    const PW = 841.68;
    const c = data.calculation;
    const inp = (c.inputs ?? {}) as Record<string, unknown>;
    const meta = surekliBildirimMetaFromInputs(inp);
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const gorev = str(inp.eski_mahal) || '—';
    const gidilen = str(inp.yeni_mahal) || '—';
    const totalRaw = c.result?.total_tl;
    const total =
      typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : rows.reduce((s, r) => s + r.satir_toplam_tl, 0);
    const eff = c.result?.effective_daily_tl ?? 0;
    const fy = Number(c.rules_snapshot?.fiscal_year);
    const fiscalStr = Number.isFinite(fy) ? String(fy) : '—';
    const parseDerece = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) {
        const d = Math.round(v);
        return d >= 1 && d <= 15 ? d : null;
      }
      if (typeof v === 'string') {
        const m = /^(\d+)/.exec(v.trim());
        if (!m) return null;
        const d = parseInt(m[1], 10);
        return Number.isFinite(d) && d >= 1 && d <= 15 ? d : null;
      }
      return null;
    };
    const derece = parseDerece(inp.derece);
    const ekBand = inp.ek_gosterge_band as EkGostergeBand | undefined;
    const ekBandTr: Record<string, string> = {
      g8000_ust: '8000 üstü',
      g6400_8000: '6400–8000',
      g3600_6400: '3600–6400',
      alt3600: '3600 altı',
    };
    const kadStr = (metaScalar(meta.kadro_kademesi) || metaScalar(meta['kadroKademesi'])).trim();
    const kademeDigits = /^\d+$/.test(kadStr) ? kadStr : '';
    const kademeFree = kadStr && !kademeDigits ? kadStr : '';
    const ekTr = ekBand && ekBandTr[ekBand] ? ekBandTr[ekBand] : '';
    /** PDF: "1/1 / 6400–8000" (derece/kademe / ek gösterge), "1. derece" değil */
    const headFromMeta = (): string | null => {
      if (derece != null && kademeDigits) return `${derece}/${kademeDigits}`;
      if (derece != null && kademeFree) return `${derece}/${kademeFree}`;
      if (derece != null) return String(derece);
      if (kadStr) return kadStr;
      return null;
    };
    const h = headFromMeta();
    const autoParts: string[] = [];
    if (h) autoParts.push(h);
    if (ekTr) autoParts.push(ekTr);
    const autoKadroHucresi = autoParts.length > 0 ? autoParts.join(' / ') : '';
    const rawKadroManual = (
      metaScalar(meta.ek_gosterge_hucresi) ||
      metaScalar(meta['ekGostergeHucresi']) ||
      ''
    ).trim();
    let kadroHucresi: string;
    if (rawKadroManual) {
      kadroHucresi = rawKadroManual;
      if (
        derece != null &&
        kadroHucresi !== '—' &&
        !/\d+\s*\.\s*derece\b/i.test(kadroHucresi) &&
        !/^\d+\s*\/\s*\S/.test(kadroHucresi)
      ) {
        const head = kademeDigits ? `${derece}/${kademeDigits}` : String(derece);
        kadroHucresi = `${head} / ${kadroHucresi}`;
      }
    } else {
      kadroHucresi = autoKadroHucresi || '—';
    }
    const mudurParsed = parseBirimYetkilisi(str((inp as Record<string, unknown>).birim_yetkilisi_unvan));
    const mudurAd = (mudurParsed.adText || str(data.mudur_adi_belge) || '—').slice(0, 80);
    const mudurUnvan = (mudurParsed.unvanText || 'Okul müdürü').slice(0, 80);
    const docDt = surekliPdfDocDateFromMeta(meta) ?? (c.finalized_at ?? c.created_at);
    const d = docDt instanceof Date ? docDt : new Date(String(docDt));
    const tarihStr = Number.isFinite(d.getTime())
      ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
      : '—';

    /** PyMuPDF ile `sürekli.pdf` şablonundan — x: sol iç, y: üstten (fitz). */
    const x0 = 20.3;
    const xR = 825.48;
    /** Şablondaki Nereden | Nereye dikey (PyMuPDF ~102.74). */
    const xSp = 102.74;
    const xN = 212.69;
    const xIl = 327.53;
    const xGn = 378.91;
    const xYv = 419.23;
    const xT1 = 460.03;
    const xRay = 502.54;
    const xSab = 549.46;
    const xKm = 598.06;
    const xDeg = 639.46;
    const xTot = 687.48;
    const xMid1 = 328.97;
    const xMid2 = 548.86;
    const xRight0 = 550.9;
    const leftBoxR = 326.92;
    const yBodyTopF = 172.94;
    const yBodyBotF = 298.73;

    const page = doc.addPage([PW, PH]);
    const yl = (yf: number) => PH - yf;
    const pdfMidY = (topFitz: number, botFitz: number) => (yl(topFitz) + yl(botFitz)) / 2;
    const txtY = (topFitz: number, size: number) => PH - topFitz - size * 0.82;
    const hSeg = (yf: number, xa: number, xb: number) => drawHLine(page, xa, xb, yl(yf), stroke);
    const vSeg = (xf: number, yfTop: number, yfBot: number) => drawVLine(page, xf, yl(yfBot), yl(yfTop), stroke);

    const drawTxt = (t: string, x: number, topFitz: number, size: number, f: PDFFont, col = ink, maxW?: number) => {
      const s = maxW != null ? truncateTextToWidth(f, t, size, maxW) : t;
      page.drawText(s, { x, y: txtY(topFitz, size), size, font: f, color: col });
    };
    const drawTxtR = (t: string, xL: number, xRCell: number, topFitz: number, size: number, f: PDFFont) => {
      const tw = f.widthOfTextAtSize(t, size);
      const x = Math.max(xL + 1.5, xRCell - tw - 2);
      page.drawText(t, { x, y: txtY(topFitz, size), size, font: f, color: ink });
    };
    const drawTxtC = (t: string, xL: number, xR: number, topFitz: number, size: number, f: PDFFont) => {
      const tw = f.widthOfTextAtSize(t, size);
      const x = (xL + xR - tw) / 2;
      page.drawText(t, { x, y: txtY(topFitz, size), size, font: f, color: ink });
    };

    const zeroRow = (key: string): SurekliPdfRow => ({
      key,
      label: '',
      gun_sayisi: 0,
      yevmiye_payi: 0,
      tutar_tl: 0,
      rayic_tl: 0,
      sabit_tl: 0,
      mesafe_km: 0,
      degisken_tl: 0,
      satir_toplam_tl: 0,
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const structured = inp.es_dahil !== undefined || inp.cocuk_dahil_adet !== undefined;
    const nCocuk = Math.min(5, Math.max(0, Math.floor(Number(inp.cocuk_dahil_adet ?? 0))));
    const showEs = structured && inp.es_dahil === true;
    const visibleRows: SurekliPdfRow[] = (() => {
      const oz = byKey.get('aile_ozet');
      if (oz) {
        return [byKey.get('kendisi') ?? zeroRow('kendisi'), oz];
      }
      const out: SurekliPdfRow[] = [byKey.get('kendisi') ?? zeroRow('kendisi')];
      if (showEs) out.push(byKey.get('es') ?? zeroRow('es'));
      if (structured) {
        for (let i = 1; i <= nCocuk; i++) out.push(byKey.get(`cocuk_${i}`) ?? zeroRow(`cocuk_${i}`));
      }
      return out;
    })();

    const nBands = Math.max(2, visibleRows.length + 1);
    const bodyStep = (yBodyBotF - yBodyTopF) / nBands;
    const rowMidFitz = (i: number) => yBodyTopF + (i + 0.5) * bodyStep;

    const colSum = visibleRows.reduce(
      (a, r) => ({
        tut: a.tut + r.tutar_tl,
        ray: a.ray + r.rayic_tl,
        sab: a.sab + r.sabit_tl,
        km: a.km + r.mesafe_km,
        deg: a.deg + r.degisken_tl,
      }),
      { tut: 0, ray: 0, sab: 0, km: 0, deg: 0 },
    );

    /* --- dış çerçeve --- */
    drawRect(page, 18.26, yl(40.08), 826.8 - 18.26, 299.75 - 40.08, stroke);
    drawVLine(page, 19.58, yl(298.73), yl(42.12), stroke);

    /* üst üçlü yatay */
    for (const yf of [40.08, 41.4, 59.52, 78.36, 100.22, 113.78, 115.1] as const) {
      hSeg(yf, x0, leftBoxR);
      if (yf <= 41.4 || yf >= 113.78) hSeg(yf, xMid1, xMid2);
      hSeg(yf, xRight0, xR);
    }
    hSeg(154.1, 550.18, xR);

    /* dikey: sol blok + orta üst + sağ */
    vSeg(18.26, 42.12, 113.78);
    vSeg(19.58, 115.83, 298.73);
    vSeg(212.69, 42.12, 113.78);
    vSeg(326.93, 42.12, 113.78);
    vSeg(328.25, 42.12, 113.78);
    vSeg(548.86, 42.12, 113.78);
    vSeg(550.18, 42.12, 113.78);
    vSeg(687.48, 42.12, 60.24);
    vSeg(687.48, 79.08, 113.78);
    vSeg(720.6, 60.24, 79.08);
    vSeg(825.48, 42.12, 113.78);
    vSeg(826.8, 115.83, 298.73);

    /* tablo gövdesi ızgarası */
    for (const yf of [130.7, 154.1] as const) {
      if (yf === 130.7) {
        hSeg(yf, xGn, xRay);
        hSeg(yf, xSab, xTot);
      }
    }
    hSeg(yBodyTopF, x0, xR);
    for (let k = 1; k <= nBands; k++) hSeg(yBodyTopF + k * bodyStep, x0, xR);
    hSeg(300.05, x0, xR);
    vSeg(102.74, yBodyTopF, yBodyBotF);
    const yHdTop = 115.83;
    const yGndInner = 130.7;
    vSeg(212.69, yHdTop, yBodyBotF);
    vSeg(327.53, yHdTop, yBodyBotF);
    vSeg(378.91, yHdTop, yBodyBotF);
    vSeg(419.23, yGndInner, yBodyBotF);
    vSeg(460.03, yGndInner, yBodyBotF);
    vSeg(502.54, yHdTop, yBodyBotF);
    vSeg(549.46, yHdTop, yBodyBotF);
    vSeg(598.06, 131.43, yBodyBotF);
    vSeg(639.46, 154.83, yBodyBotF);
    vSeg(687.48, yHdTop, yBodyBotF);
    vSeg(825.48, yHdTop, yBodyBotF);

    /* başlık */
    drawLinesCenteredInBand(
      page,
      ['YURTİÇİ SÜREKLİ GÖREV', 'YOLLUĞU BİLDİRİMİ'],
      xMid1,
      yl(42.12),
      yl(113.78),
      xMid2 - xMid1,
      11.5,
      fontBold,
      ink,
    );

    /* sol üst alan metinleri */
    drawTxt('Adı - Soyadı', x0 + 0.5, 45.8, 8.25, fontBold, muted);
    drawTxt((data.teacherName || '—').slice(0, 48), 225, 45.8, 9, font);
    drawTxt('Ünvanı', x0 + 0.5, 64.7, 8.25, fontBold, muted);
    const unvanPdf = str(inp.unvan) || 'Öğretmen';
    drawTxt(unvanPdf.slice(0, 40), 225, 64.4, 9, font);
    drawTxt('Aylık Kadro Derecesi ve Ek Göstergesi', x0 + 0.5, 83.5, 7.75, fontBold, muted);
    drawTxt(kadroHucresi.slice(0, 56), 225, 83.5, 8.25, font);
    drawTxt('Gündeliği', x0 + 0.5, 102.6, 8.25, fontBold, muted);
    drawTxt(fmtTrTl(eff), 225, 102.6, 9, fontBold, ink, leftBoxR - 2 - 225);

    /* sağ üst */
    drawTxt('Dairesi', 551.3, 46.1, 7.75, fontBold, muted);
    drawTxtR(truncateTextToWidth(font, (data.schoolName || '—').slice(0, 40), 8.75, 260), 552, xR - 6, 46.1, 8.75, font);
    drawTxt('Bütçe Yılı', 551.3, 65, 7.75, fontBold, muted);
    drawTxt(fiscalStr, 766.4, 65, 9, font);
    drawTxt('Önceden Avans almışsa Aldığı', 551.3, 81.1, 7, fontBold, muted);
    drawTxt('Saymanlık ve Tarihi', 551.3, 90.1, 7, fontBold, muted);
    drawTxt(metaScalar(meta.avans_durumu) || metaScalar(meta['avansDurumu']) || '—', 735, 85.3, 8.25, font);
    drawTxt('Atama Tarihi', 551.3, 103.3, 7.75, fontBold, muted);
    drawTxt(metaScalar(meta.atama_tarihi) || metaScalar(meta['atamaTarihi']) || '—', 742.2, 103.3, 8.25, font);

    /* tablo başlıkları — birleşik üst satır + alt başlıklar (orta hizalı) */
    drawLinesCenteredInBand(page, ['Nereden      /       Nereye', 'Gidildiği'], x0, yl(115.1), yl(yBodyTopF), xN - x0, 5.2, fontBold, ink);
    drawTextFittedInRect(page, fontBold, 'Adı Soyadı', xN, yl(132), yl(170), xIl - xN, 6.2, 4.25, ink);
    drawLinesCenteredInBand(page, ['Akrabalık', 'Derecesi'], xIl, yl(115.1), yl(130.7), xGn - xIl, 5.2, fontBold, ink);
    drawTextFittedInRect(page, fontBold, 'GÜNDELİKLER', xGn, yl(115.1), yl(130.7), xRay - xGn, 7, 4.25, ink);
    drawTextFittedInRect(page, fontBold, 'YER DEĞİŞTİRME GİDERİ', xSab, yl(115.1), yl(130.7), xTot - xSab, 7, 4, ink);
    drawLinesCenteredInBand(page, ['Taşıt Ücreti', '2'], xRay, yl(115.1), yl(130.7), xSab - xRay, 5.2, fontBold, ink);
    drawTextFittedInRect(page, fontBold, 'Gün Sayısı', xGn, yl(142), yl(154), xYv - xGn, 6, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Yevmiye', xYv, yl(142), yl(154), xT1 - xYv, 6, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Tutarı', xT1, yl(139), yl(149), xRay - xT1, 6, 4, ink);
    drawTextFittedInRect(page, fontBold, '1', xT1, yl(150), yl(162), xRay - xT1, 5.5, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Sabit Unsur', xSab, yl(135), yl(143), xKm - xSab, 5.8, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Değişken Unsur', xKm, yl(135), yl(143), xTot - xKm, 5.8, 3.75, ink);
    drawTextFittedInRect(page, fontBold, 'TL.  3', xSab, yl(155), yl(164), xKm - xSab, 5.6, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Mesafe Km', xKm, yl(155), yl(164), xDeg - xKm, 5.6, 4, ink);
    drawTextFittedInRect(page, fontBold, 'Tutarı  4', xDeg, yl(155), yl(164), xTot - xDeg, 5.6, 4, ink);
    drawLinesCenteredInBand(page, ['TOPLAM', '1+2+3+4'], xTot, yl(115.1), yl(yBodyTopF), xR - xTot, 6, fontBold, ink);

    const relationPdfLabel = (r: SurekliPdfRow): string => {
      if (r.key === 'kendisi') return 'Kendisi';
      if (r.key === 'es') return 'Eş';
      if (r.key === 'aile_ozet') return (r.label || 'Aile ferdi').slice(0, 32);
      const m = /^cocuk_(\d+)$/.exec(r.key);
      return m ? `ÇOCUK ${m[1]}` : (r.label || '—').slice(0, 32);
    };
    const adSoyadCol = (i: number): string => {
      const r = visibleRows[i]!;
      if (r.key === 'kendisi') return (data.teacherName || '—').trim().slice(0, 44);
      if (r.key === 'es') return metaScalar(meta.es_ad_soyad) || '—';
      const m = /^cocuk_(\d+)$/.exec(r.key);
      const idx = m ? parseInt(m[1]!, 10) - 1 : -1;
      const ca = meta.cocuk_adlari;
      if (Array.isArray(ca) && idx >= 0 && idx < ca.length) return String(ca[idx] ?? '').trim().slice(0, 44) || '—';
      return '—';
    };

    /* veri satırları */
    for (let i = 0; i < visibleRows.length; i++) {
      const r = visibleRows[i]!;
      const yRow = rowMidFitz(i) - 3;
      if (i === 0) {
        drawTxt(truncateTextToWidth(font, gorev, 7, xSp - x0 - 4), x0 + 2, yRow, 7, font);
        drawTxt(truncateTextToWidth(font, gidilen, 7, xN - xSp - 3), xSp + 2, yRow, 7, font);
      }
      drawTxt(truncateTextToWidth(font, adSoyadCol(i), 7, xIl - xN - 4), xN + 2, yRow, 7, font);
      drawTxt(truncateTextToWidth(font, relationPdfLabel(r), 7, xGn - xIl - 4), xIl + 2, yRow, 7, font);
      const gunPdf = r.key === 'kendisi' ? String(r.gun_sayisi) : '';
      drawTxtC(gunPdf, xGn, xYv, yRow, 7, font);
      drawTxtC(yevmiyePayiDisplayText(r.yevmiye_payi), xYv, xT1, yRow, 7, font);
      drawTxtC(fmtTrTl(r.tutar_tl), xT1, xRay, yRow, 7, font);
      drawTxtC(fmtTrTl(r.rayic_tl), xRay, xSab, yRow, 7, font);
      drawTxtC(fmtTrTl(r.sabit_tl), xSab, xKm, yRow, 7, font);
      drawTxtC(r.mesafe_km > 0 ? String(Math.round(r.mesafe_km)) : '—', xKm, xDeg, yRow, 7, font);
      drawTxtC(fmtTrTl(r.degisken_tl), xDeg, xTot, yRow, 7, font);
      drawTxtC(fmtTrTl(r.satir_toplam_tl), xTot, xR - 2, yRow, 7, fontBold);
    }
    const yi = rowMidFitz(visibleRows.length) - 3;
    drawTxt('TOPLAM', 336.1, yi, 7.5, fontBold, ink);
    drawTxtC(fmtTrTl(colSum.tut), xT1, xRay, yi, 7, fontBold);
    drawTxtC(fmtTrTl(colSum.ray), xRay, xSab, yi, 7, fontBold);
    drawTxtC(fmtTrTl(colSum.sab), xSab, xKm, yi, 7, fontBold);
    drawTxtC(colSum.km > 0 ? String(Math.round(colSum.km)) : '—', xKm, xDeg, yi, 7, fontBold);
    drawTxtC(fmtTrTl(colSum.deg), xDeg, xTot, yi, 7, fontBold);
    drawTxtC(fmtTrTl(total), xTot, xR - 2, yi, 8, fontBold);

    /* dip metin + imza */
    const teacher = (data.teacherName || '—').trim();
    const ft = 305;
    const wFoot = xR - x0 - 24;
    const l1 = `Yurt içi sürekli görev yolluğu olarak tahakkuk eden ${gorev} dan ${gidilen} na atanan`;
    drawTxt(truncateTextToWidth(font, l1, 8, wFoot), x0 + 12, ft, 8, font);
    const l2 = `${teacher}  ${fmtTrTl(total)} TL${TR_APOST}nin ödenmesini arz ederim.`;
    drawTxt(truncateTextToWidth(font, l2, 9, wFoot), x0 + 12, ft + 14, 9, font);
    drawTextCentered(page, tarihStr, x0, pdfMidY(ft + 30, ft + 44), xR - x0, 9, font, ink);
    const sigTop = ft + 52;
    drawTxt('Birim Yetkilisi', x0 + 12, sigTop, 8, fontBold, muted);
    drawTxtR('Öğretmen', xR - 200, xR - 12, sigTop, 8, fontBold);
    drawHLine(page, x0 + 12, x0 + 220, yl(sigTop + 22), stroke);
    drawHLine(page, xR - 220, xR - 12, yl(sigTop + 22), stroke);
    drawTxt(truncateTextToWidth(font, mudurAd, 9, 200), x0 + 12, sigTop + 26, 9, font);
    drawTxt(mudurUnvan, x0 + 12, sigTop + 38, 8, fontBold);
    drawTxtR(truncateTextToWidth(font, teacher.slice(0, 36), 9, 180), xR - 220, xR - 12, sigTop + 26, 9, font);
    const ogrLbl = 'Öğretmen';
    const twO = fontBold.widthOfTextAtSize(ogrLbl, 8);
    page.drawText(ogrLbl, { x: xR - 12 - twO, y: txtY(sigTop + 38, 8), size: 8, font: fontBold, color: muted });

    const pdf = await doc.save();
    return Buffer.from(pdf);
  }

  private async buildGeciciBildirimPdf(data: YollukOfficialPdfInput, gb: GeciciBildirimComputed): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    const stroke = rgb(0, 0, 0);
    const ink = rgb(0, 0, 0);
    const muted = rgb(0.18, 0.18, 0.2);

    const pageW = 842;
    const pageH = 595;
    const m = 13;
    /** Üst kenardan boşluk (içerik y=pageH-topPad); yatay tablo hâlâ m ile hizalı */
    const topPad = 40;
    const c = data.calculation;
    type BildInp = {
      rows?: GeciciBildirimRowInput[];
      ad_soyad?: string;
      unvan?: string;
      tc_kimlik?: string;
      iban?: string;
      dairesi?: string;
      birim_yetkilisi_unvan?: string;
      pdf_duzenleme_tarihi?: string;
    };
    const rawBild = c.inputs?.bildirim as BildInp | undefined;
    const rawBildRows = rawBild?.rows ?? [];
    const strInp = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const fy = Number(c.rules_snapshot?.fiscal_year);
    const fiscalStr = Number.isFinite(fy) ? String(fy) : '—';
    const eff = c.result?.effective_daily_tl ?? 0;
    const total = c.result?.total_tl ?? 0;
    const ad = (
      strInp(gb.ad_soyad) ||
      strInp(rawBild?.ad_soyad) ||
      (data.teacherName || '').trim() ||
      '—'
    ).slice(0, 120);
    const unvan = (strInp(gb.unvan) || strInp(rawBild?.unvan) || '—').slice(0, 80);
    const tc = (strInp(gb.tc_kimlik) || strInp(rawBild?.tc_kimlik) || '—').slice(0, 16);
    const ibanRaw =
      strInp(gb.iban) || strInp(rawBild?.iban) || strInp(data.teacherIban ?? undefined);
    const ibanNorm = ibanRaw.replace(/\s/g, '').toUpperCase();
    const sn = (data.schoolName || '').trim();
    const daire = (
      sn ? `${sn} Müdürlüğü` : strInp(gb.dairesi) || strInp(rawBild?.dairesi) || '—'
    ).slice(0, 100);
    const birimRaw = strInp(gb.birim_yetkilisi_unvan) || strInp(rawBild?.birim_yetkilisi_unvan);
    const parsedYet = parseBirimYetkilisi(birimRaw);
    const mudurAdiPdf = (
      parsedYet.adText ||
      strInp(data.mudur_adi_belge) ||
      '—'
    ).slice(0, 100);
    const mudurUnvanPdf = (parsedYet.unvanText || 'Okul müdürü').slice(0, 100);
    const imzaTarihRaw =
      strInp(gb.pdf_duzenleme_tarihi) ||
      strInp(rawBild?.pdf_duzenleme_tarihi) ||
      strInp((rawBild as Record<string, unknown> | undefined)?.['pdfDuzenlemeTarihi']);
    const imzaTarihTr = imzaTarihRaw ? bildirimPdfDateToTrDisplay(imzaTarihRaw) : '';

    // Resmi form ızgarası (yaklaşık): yolluk2026.pdf dikey çizgiler 13.1 … 818.5
    const colW = [
      99.36, 146.91, 43.92, 43.94, 37.56, 47.52, 75.99, 63.84, 48.96, 46.94, 23.46, 23.46, 103.56,
    ];
    const colX: number[] = [m];
    for (const w of colW) colX.push(colX[colX.length - 1]! + w);
    const tableRight = colX[13]!;
    const geInPdf = c.inputs as Partial<GeciciInputs> | undefined;
    const ozYol = Math.max(0, Number(geInPdf?.yol_masrafi_tl ?? 0));
    const ozKon = Math.max(0, Number(geInPdf?.konaklama_tl ?? 0));
    const ozDig = Math.max(0, Number(geInPdf?.diger_tl ?? 0));
    const ozTas = Math.max(0, Number(geInPdf?.tasit_ucreti_tl ?? 0));
    const ozTak = Math.max(0, Number(geInPdf?.taksi_tl ?? 0));

    const drawCell = (
      page: PDFPage,
      text: string,
      xi: number,
      yBase: number,
      wi: number,
      size: number,
      opts?: { bold?: boolean; alignRight?: boolean; maxLen?: number },
    ) => {
      const f = opts?.bold ? fontBold : font;
      const ml = opts?.maxLen ?? 120;
      const t = text.length > ml ? `${text.slice(0, ml - 1)}…` : text;
      const tw = f.widthOfTextAtSize(t, size);
      const pad = 2;
      const tx = opts?.alignRight ? xi + wi - tw - pad : xi + pad;
      page.drawText(t, { x: Math.max(xi + pad, tx), y: yBase, size, font: f, color: ink });
    };

    const drawOfficialHeaderBand = (page: PDFPage, yTop: number): number => {
      const inner = tableRight - m;
      const wL = Math.round(inner * 0.405);
      const wR = Math.round(inner * 0.355);
      const gap = 10;
      const wC = inner - wL - wR - 2 * gap;
      const xL = m;
      const xC = xL + wL + gap;
      const xR = xC + wC + gap;
      const bandH = 78;
      const row4 = bandH / 4;

      drawRect(page, xL, yTop, wL, bandH, stroke);
      for (let k = 1; k < 4; k++) drawHLine(page, xL, xL + wL, yTop - k * row4, stroke);
      const labSize = 7.25;
      const valSize = 9;
      const labPad = 3;
      const labGap = 5;
      const labelRows: [string, string][] = [
        ['Adı Soyadı:', ad.slice(0, 52)],
        ['Ünvanı:', unvan.slice(0, 52)],
        ['TC:', tc],
        ['Gündeliği:', fmtTrTl(eff)],
      ];
      let maxLabW = 0;
      for (const [lb] of labelRows) {
        maxLabW = Math.max(maxLabW, fontBold.widthOfTextAtSize(lb, labSize));
      }
      const xLab = xL + labPad;
      const xVal = xLab + maxLabW + labGap;
      const valMaxW = Math.max(40, xL + wL - xVal - labPad);
      let yy = yTop - 10;
      for (const [lb, val] of labelRows) {
        const lw = fontBold.widthOfTextAtSize(lb, labSize);
        page.drawText(lb, { x: xLab + maxLabW - lw, y: yy, size: labSize, font: fontBold, color: muted });
        const v = truncateTextToWidth(font, val, valSize, valMaxW);
        page.drawText(v, { x: xVal, y: yy - (valSize - labSize) * 0.12, size: valSize, font, color: ink });
        yy -= row4;
      }

      drawRect(page, xC, yTop, wC, bandH, stroke);
      drawLinesCenteredInBand(
        page,
        ['YURTİÇİ/YURTDIŞI', 'GEÇİCİ YOLLUĞU', 'BİLDİRİMİ'],
        xC,
        yTop,
        yTop - bandH,
        wC,
        11.5,
        fontBold,
        ink,
      );

      drawRect(page, xR, yTop, wR, bandH, stroke);
      drawHLine(page, xR, xR + wR, yTop - bandH / 2, stroke);
      const lblRSz = 7.25;
      const daireLbl = 'Dairesi:';
      const wDaireLbl = fontBold.widthOfTextAtSize(daireLbl, lblRSz);
      page.drawText(daireLbl, { x: xR + 3, y: yTop - 10, size: lblRSz, font: fontBold, color: muted });
      page.drawText(daire.slice(0, 48), { x: xR + 3 + wDaireLbl + 3, y: yTop - 10, size: 8.75, font, color: ink });
      const yRBy = yTop - 10 - bandH / 2;
      const byLbl = 'Bütçe Yılı:';
      const wByLbl = fontBold.widthOfTextAtSize(byLbl, lblRSz);
      page.drawText(byLbl, { x: xR + 3, y: yRBy, size: lblRSz, font: fontBold, color: muted });
      page.drawText(fiscalStr, { x: xR + 3 + wByLbl + 3, y: yRBy, size: 9.25, font, color: ink });

      return yTop - bandH - 10;
    };

    const drawTwoRowTableHeader = (page: PDFPage, yTop: number): number => {
      const H1 = 21;
      const H2 = 20;
      const y0 = yTop;
      const y1 = yTop - H1;
      const y2 = yTop - H1 - H2;
      drawHLine(page, colX[0]!, tableRight, y0, stroke);
      /* y1: üst birleşik başlık altı — hareket(2–4), gündelikler(4–8), taşıt(8–10), döviz(10–12) */
      drawHLine(page, colX[2]!, colX[4]!, y1, stroke);
      drawHLine(page, colX[4]!, colX[8]!, y1, stroke);
      drawHLine(page, colX[8]!, colX[10]!, y1, stroke);
      drawHLine(page, colX[10]!, colX[12]!, y1, stroke);
      drawHLine(page, colX[0]!, tableRight, y2, stroke);
      const vFull = (x: number) => drawVLine(page, x, y2, y0, stroke);
      const vBand2 = (x: number) => drawVLine(page, x, y2, y1, stroke);
      vFull(colX[0]!);
      vFull(colX[1]!);
      vFull(colX[2]!);
      vBand2(colX[3]!);
      vFull(colX[4]!);
      vBand2(colX[5]!);
      vBand2(colX[6]!);
      vBand2(colX[7]!);
      vFull(colX[8]!);
      vBand2(colX[9]!);
      vFull(colX[10]!);
      vBand2(colX[11]!);
      vFull(colX[12]!);
      vFull(colX[13]!);

      drawLinesCenteredInBand(page, ['Yolculuk ve', 'Oturma Tarihleri'], colX[0]!, y0, y2, colW[0]!, 5.2, fontBold, ink);
      drawLinesCenteredInBand(
        page,
        ['Nereden Nereye Yolculuk Edildiği', 'veya Nerede Oturduğu'],
        colX[1]!,
        y0,
        y2,
        colW[1]!,
        5,
        fontBold,
        ink,
      );
      drawLinesCenteredInBand(page, ['Hareket', 'Saatleri'], colX[2]!, y0, y1, colW[2]! + colW[3]!, 5.5, fontBold, ink);
      drawTextCentered(
        page,
        'GÜNDELİKLER',
        colX[4]!,
        (y0 + y1) / 2 + 2,
        colW[4]! + colW[5]! + colW[6]! + colW[7]!,
        6.2,
        fontBold,
        ink,
      );
      drawLinesCenteredInBand(page, ['TAŞIT VE', 'ZORUNLU'], colX[8]!, y0, y1, colW[8]! + colW[9]!, 5.2, fontBold, ink);
      drawTextCentered(page, 'Dövizin', colX[10]!, (y0 + y1) / 2 + 2, colW[10]! + colW[11]!, 5.8, fontBold, ink);
      drawLinesCenteredInBand(page, ['Toplam Tutar', '(TL)'], colX[12]!, y0, y2, colW[12]!, 5.2, fontBold, ink);

      const yMidLo = (y1 + y2) / 2 + 1;
      drawTextCentered(page, 'Gidiş', colX[2]!, yMidLo, colW[2]!, 5.5, fontBold, ink);
      drawTextCentered(page, 'Dönüş', colX[3]!, yMidLo, colW[3]!, 5.5, fontBold, ink);
      drawLinesCenteredInBand(page, ['Gün', 'Sayısı'], colX[4]!, y1, y2, colW[4]!, 4.6, fontBold, ink);
      drawLinesCenteredInBand(page, ['YEVMİYE'], colX[5]!, y1, y2, colW[5]!, 5, fontBold, ink);
      drawLinesCenteredInBand(page, ['Bir Günlüğü', '(TL)'], colX[6]!, y1, y2, colW[6]!, 4.5, fontBold, ink);
      drawLinesCenteredInBand(page, ['Tutarı', '(TL)'], colX[7]!, y1, y2, colW[7]!, 4.5, fontBold, ink);
      drawLinesCenteredInBand(page, ['Çeşidi ve', 'Mevkii'], colX[8]!, y1, y2, colW[8]!, 4.3, fontBold, ink);
      drawLinesCenteredInBand(page, ['Tutar', '(TL)'], colX[9]!, y1, y2, colW[9]!, 4.3, fontBold, ink);
      drawLinesCenteredInBand(page, ['Cinsi'], colX[10]!, y1, y2, colW[10]!, 4.5, fontBold, ink);
      drawLinesCenteredInBand(page, ['Kuru', '(TL)'], colX[11]!, y1, y2, colW[11]!, 4.2, fontBold, ink);

      return y2;
    };

    const drawDataRow = (
      page: PDFPage,
      r: GeciciBildirimRowComputed,
      raw: GeciciBildirimRowInput | undefined,
      yTop: number,
      rowH: number,
    ): number => {
      const y0 = yTop - rowH;
      drawHLine(page, colX[0]!, tableRight, yTop, stroke);
      drawHLine(page, colX[0]!, tableRight, y0, stroke);
      for (let i = 0; i <= 13; i++) drawVLine(page, colX[i]!, y0, yTop, stroke);
      const yTxt = yTop - rowH + 5;
      const pad = 2;
      const yerW = Math.max(8, colW[1]! - 2 * pad);
      const tasitW = Math.max(6, colW[8]! - 2 * pad);
      const yerShow = truncateTextToWidth(
        font,
        (bildirimYerDisplay(raw ?? ({} as GeciciBildirimRowInput)) ?? r.yer ?? '').toUpperCase(),
        6.5,
        yerW,
      );
      drawCell(page, r.tarih ?? '', colX[0]!, yTxt, colW[0]!, 7);
      drawCell(page, yerShow, colX[1]!, yTxt, colW[1]!, 6.5);
      drawCell(page, r.gidis_saat ?? '', colX[2]!, yTxt, colW[2]!, 7);
      drawCell(page, r.donus_saat ?? '', colX[3]!, yTxt, colW[3]!, 7);
      drawCell(page, String(r.gun_sayisi), colX[4]!, yTxt, colW[4]!, 7, { alignRight: true });
      drawCell(page, r.yevmiye_metin, colX[5]!, yTxt, colW[5]!, 7, { alignRight: true });
      drawCell(page, fmtTrTl(r.bir_gunluk_tl), colX[6]!, yTxt, colW[6]!, 7, { alignRight: true });
      drawCell(page, fmtTrTl(r.gundelik_tutar_tl), colX[7]!, yTxt, colW[7]!, 7, { alignRight: true });
      drawCell(page, truncateTextToWidth(font, (r.tasit_tip ?? '').toUpperCase(), 6.5, tasitW), colX[8]!, yTxt, colW[8]!, 6.5);
      drawCell(page, fmtTrTl(r.tasit_ucret_tl), colX[9]!, yTxt, colW[9]!, 6.5, { alignRight: true });
      drawCell(page, fmtTrTl(r.doviz_cinsi_tl ?? 0), colX[10]!, yTxt, colW[10]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[11]!, yTxt, colW[11]!, 6.5, { alignRight: true });
      drawCell(page, fmtTrTl(r.satir_toplam_tl), colX[12]!, yTxt, colW[12]!, 7, { alignRight: true, bold: true });
      return y0;
    };

    const drawOzetMasrafTableRow = (page: PDFPage, yTop: number, rowH: number, labelSol: string, tutar: number): number => {
      if (tutar <= 1e-9) return yTop;
      const y0 = yTop - rowH;
      drawHLine(page, colX[0]!, tableRight, yTop, stroke);
      drawHLine(page, colX[0]!, tableRight, y0, stroke);
      for (let i = 0; i <= 13; i++) drawVLine(page, colX[i]!, y0, yTop, stroke);
      const yTxt = yTop - rowH + 5;
      const lw = colW[0]! + colW[1]! + colW[2]! + colW[3]! + colW[4]! + colW[5]!;
      drawCell(page, truncateTextToWidth(font, labelSol, 6.8, lw - 4), colX[0]!, yTxt, lw, 6.8);
      drawCell(page, '—', colX[6]!, yTxt, colW[6]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[7]!, yTxt, colW[7]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[8]!, yTxt, colW[8]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[9]!, yTxt, colW[9]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[10]!, yTxt, colW[10]!, 6.5, { alignRight: true });
      drawCell(page, '—', colX[11]!, yTxt, colW[11]!, 6.5, { alignRight: true });
      drawCell(page, fmtTrTl(tutar), colX[12]!, yTxt, colW[12]!, 7, { alignRight: true, bold: true });
      return y0;
    };

    const drawGrandTotalRow = (page: PDFPage, yTop: number, rowH: number): number => {
      const y0 = yTop - rowH;
      drawHLine(page, colX[0]!, tableRight, yTop, stroke);
      drawHLine(page, colX[0]!, tableRight, y0, stroke);
      for (let i = 0; i <= 13; i++) drawVLine(page, colX[i]!, y0, yTop, stroke);
      const yTxt = yTop - rowH + 5;
      drawCell(page, 'GENEL TOPLAM', colX[0]!, yTxt, colW[0]! + colW[1]! + colW[2]! + colW[3]! + colW[4]! + colW[5]!, 7.5, { bold: true });
      drawCell(page, fmtTrTl(gb.toplam_gundelik_tl), colX[7]!, yTxt, colW[7]!, 7.5, { alignRight: true, bold: true });
      const tasitSum = gb.rows.reduce((s, x) => s + x.tasit_ucret_tl, 0);
      const tasitCol = tasitSum + ozTas;
      drawCell(page, fmtTrTl(tasitCol), colX[9]!, yTxt, colW[9]!, 7, { alignRight: true, bold: true });
      const dovizSum = gb.rows.reduce((s, x) => s + (x.doviz_cinsi_tl ?? 0), 0);
      drawCell(page, fmtTrTl(dovizSum), colX[10]!, yTxt, colW[10]!, 7, { alignRight: true, bold: true });
      drawCell(page, '—', colX[11]!, yTxt, colW[11]!, 7, { alignRight: true });
      const sumSatir = gb.rows.reduce((s, x) => s + x.satir_toplam_tl, 0);
      const totalNum = Number.isFinite(Number(total)) ? Number(total) : sumSatir + ozYol + ozKon + ozDig + ozTas + ozTak;
      drawCell(page, fmtTrTl(totalNum), colX[12]!, yTxt, colW[12]!, 7.5, { alignRight: true, bold: true });
      return y0;
    };

    const wrapWords = (text: string, size: number, width: number): string[] => {
      const out: string[] = [];
      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) <= width) line = test;
          else {
            if (line) out.push(line);
            line = w;
          }
        }
        if (line) out.push(line);
      }
      return out.length ? out : [''];
    };

    const ROWS_PER_PAGE = 8;
    const chunks = chunkArray(gb.rows, ROWS_PER_PAGE);

    for (let pi = 0; pi < chunks.length; pi++) {
      const page = doc.addPage([pageW, pageH]);
      let y = pageH - topPad;

      if (pi === 0) {
        y = drawOfficialHeaderBand(page, y);
      } else {
        page.drawText(`Bildirim (devam ${pi + 1}/${chunks.length})`, { x: m, y: y - 2, size: 9, font: fontBold, color: ink });
        y -= 16;
      }

      let yRow = drawTwoRowTableHeader(page, y);
      const rowH = 19;
      for (let j = 0; j < chunks[pi]!.length; j++) {
        const row = chunks[pi]![j]!;
        const raw = rawBildRows[pi * ROWS_PER_PAGE + j] as GeciciBildirimRowInput | undefined;
        yRow = drawDataRow(page, row, raw, yRow, rowH);
      }
      drawHLine(page, colX[0]!, tableRight, yRow, stroke);

      if (pi === chunks.length - 1) {
        const rhOzet = 17;
        const ozetPairs: [string, number][] = [
          ['Yol masrafı', ozYol],
          ['Konaklama', ozKon],
          ['Taşıt ücreti', ozTas],
          ['Taksi / hamal', ozTak],
          ['Diğer', ozDig],
        ];
        for (const [lab, v] of ozetPairs) {
          if (v > 1e-9) yRow = drawOzetMasrafTableRow(page, yRow, rhOzet, lab, v);
        }
        yRow = drawGrandTotalRow(page, yRow, rowH + 2);
        const gapAfterTable = 18;
        let yf = yRow - gapAfterTable;
        if (ibanNorm.length >= 10) {
          const ibSize = 7;
          const ibW = Math.max(100, tableRight - m - 8);
          const ibSpaced = ibanNorm.replace(/(.{4})/g, '$1 ').trim();
          const who =
            ad && ad !== '—' && String(ad).trim()
              ? `${String(ad).trim()} adlı personelin`
              : 'ilgili personelin';
          const payNote = `Ödeme: Yukarıda genel toplamı gösterilen geçici görev yolluk bedeli; ${who} aşağıda Uluslararası Banka Hesap Numarası (IBAN) ile belirtilen hesabına ödenmesi talep olunur.`;
          const payLines = wrapWords(payNote, ibSize, ibW);
          const ibanLines = wrapWords(`IBAN: ${ibSpaced}`, ibSize, ibW);
          const ibLh = ibSize + 2.5;
          let yI = yRow - gapAfterTable;
          for (const ln of payLines) {
            page.drawText(ln, { x: m + 2, y: yI, size: ibSize, font, color: ink });
            yI -= ibLh;
          }
          for (const ln of ibanLines) {
            page.drawText(ln, { x: m + 2, y: yI, size: ibSize, font: fontBold, color: ink });
            yI -= ibLh;
          }
          yf = yI - 10;
        }
        const s8 = 8;
        const beyanPad = 4;
        const beyanW = Math.max(100, tableRight - m - 2 * beyanPad);
        const onde =
          gb.kapsam === 'yurtdisi' ? 'yurt dışında yapmış olduğum' : 'yurt içinde yapmış olduğum';
        const beyanText = `Yukarıda belirtilen tarih/saatler arasında ${onde} geçici görev yolluğu ile ilgili ${fmtTrTl(total)} harcamaya ait bildirimdir.`;
        const beyanSize = 7.5;
        const beyanLines = wrapWords(beyanText, beyanSize, beyanW);
        const beyanLh = beyanSize + 2.5;
        let yyB = yf;
        for (const ln of beyanLines) {
          page.drawText(ln, { x: m + beyanPad, y: yyB, size: beyanSize, font, color: ink });
          yyB -= beyanLh;
        }
        yf = yyB - 12;
        const inner = tableRight - m;
        const splitX = m + inner * 0.46;
        const leftBandW = splitX - m - 12;
        const rightBandW = tableRight - splitX - 12;
        const colL1 = m + 10;
        const colL2 = m + 78;
        const colR1 = splitX + 10;
        const colR2 = splitX + 78;
        const maxLW = Math.max(40, splitX - colL2 - 10);
        const maxRW = Math.max(40, tableRight - colR2 - 10);
        drawTextCentered(page, 'Birim yetkilisi', m + 6, yf, leftBandW, s8, fontBold, ink);
        drawTextCentered(page, 'Bildirim sahibi', splitX + 6, yf, rightBandW, s8, fontBold, ink);
        yf -= 18;
        page.drawText('Adı Soyadı :', { x: colL1, y: yf, size: 7, font: fontBold, color: muted });
        page.drawText(truncateTextToWidth(fontBold, mudurAdiPdf, 7, maxLW), {
          x: colL2,
          y: yf,
          size: 7,
          font: fontBold,
          color: ink,
        });
        page.drawText('Adı Soyadı :', { x: colR1, y: yf, size: 7, font: fontBold, color: muted });
        page.drawText(truncateTextToWidth(fontBold, ad, 8, maxRW), {
          x: colR2,
          y: yf,
          size: 8,
          font: fontBold,
          color: ink,
        });
        yf -= 13;
        page.drawText('Ünvanı :', { x: colL1, y: yf, size: 7, font: fontBold, color: muted });
        page.drawText(truncateTextToWidth(font, mudurUnvanPdf, 7, maxLW), {
          x: colL2,
          y: yf,
          size: 7,
          font,
          color: ink,
        });
        page.drawText('Ünvanı :', { x: colR1, y: yf, size: 7, font: fontBold, color: muted });
        page.drawText(truncateTextToWidth(font, unvan, 7, maxRW), {
          x: colR2,
          y: yf,
          size: 7,
          font,
          color: ink,
        });
        yf -= 12;
        const sigSz = 6.85;
        const labImza = 'İmza';
        const imzaLbl = `${labImza} :`;
        const wImzaLbl = fontBold.widthOfTextAtSize(imzaLbl, sigSz);
        page.drawText(imzaLbl, { x: colL1, y: yf, size: sigSz, font: fontBold, color: muted });
        drawHLine(page, colL1 + wImzaLbl + 5, splitX - 14, yf - 0.5, stroke);
        page.drawText(imzaLbl, { x: colR1, y: yf, size: sigSz, font: fontBold, color: muted });
        drawHLine(page, colR1 + wImzaLbl + 5, tableRight - 10, yf - 0.5, stroke);
        yf -= 13;
        const tarLbl = 'İmza tarihi :';
        const wTarLbl = fontBold.widthOfTextAtSize(tarLbl, sigSz);
        page.drawText(tarLbl, { x: colL1, y: yf, size: sigSz, font: fontBold, color: muted });
        if (imzaTarihTr) {
          page.drawText(truncateTextToWidth(font, imzaTarihTr, sigSz, maxLW), {
            x: colL2,
            y: yf,
            size: sigSz,
            font,
            color: ink,
          });
        } else {
          drawHLine(page, colL1 + wTarLbl + 5, splitX - 14, yf - 0.5, stroke);
        }
        page.drawText(tarLbl, { x: colR1, y: yf, size: sigSz, font: fontBold, color: muted });
        if (imzaTarihTr) {
          page.drawText(truncateTextToWidth(font, imzaTarihTr, sigSz, maxRW), {
            x: colR2,
            y: yf,
            size: sigSz,
            font,
            color: ink,
          });
        } else {
          drawHLine(page, colR1 + wTarLbl + 5, tableRight - 10, yf - 0.5, stroke);
        }
        yf -= 18;
        const footW = Math.max(100, tableRight - m - 8);
        const footLines = wrapWords(
          '(*) Bu kısım bildirim sahibinin görevi yerine getirmesinden bilgisi olan amir tarafından imzalanacaktır.',
          6.5,
          footW,
        );
        let yyF = yf;
        for (const ln of footLines) {
          page.drawText(ln, { x: m + 4, y: yyF, size: 6.5, font, color: muted });
          yyF -= 8;
        }
      }
    }

    const pdf = await doc.save();
    return Buffer.from(pdf);
  }
}
