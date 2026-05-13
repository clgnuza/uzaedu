import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import * as QRCode from 'qrcode';

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

@Injectable()
export class ButterflyExamPdfService {
  async buildSalonAttendancePdf(opts: {
    title: string;
    schoolName: string;
    roomName: string;
    buildingName: string;
    examStartsAt: Date;
    subtitleLines?: string[];
    footerLines?: string[];
    rows: Array<{ studentName: string; classLabel: string; seatLabel: string; studentNumber: string | null }>;
    /** Salon gözetmenleri (sıra: sortOrder). Boş dizi = "—" satırı. */
    proctorNames?: string[];
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const pageW = 595;
    const pageH = 842;
    const margin = 40;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    };

    const header = () => {
      const contentW = pageW - margin * 2;

      // ── Üst şerit: okul adı ─────────────────────────────────────────────
      page.drawRectangle({
        x: margin, y: y - 16, width: contentW, height: 20,
        color: rgb(0.12, 0.22, 0.48),
      });
      page.drawText(opts.schoolName, {
        x: margin + 6, y: y - 11, size: 9, font, color: rgb(1, 1, 1),
      });
      y -= 26;

      // ── Başlık ──────────────────────────────────────────────────────────
      page.drawText(opts.title, {
        x: margin, y, size: 14, font: fontBold, color: rgb(0.1, 0.15, 0.45),
      });
      y -= 6;
      page.drawLine({
        start: { x: margin, y }, end: { x: pageW - margin, y },
        thickness: 1.2, color: rgb(0.12, 0.22, 0.48),
      });
      y -= 14;

      // ── Bilgi kutuları (bina/salon | tarih | ders | saat) ───────────────
      const cols = [
        { label: 'Salon',  value: `${opts.buildingName} / ${opts.roomName}`, x: margin,        w: 160 },
        { label: 'Tarih',  value: opts.examStartsAt.toLocaleDateString('tr-TR'), x: margin + 165, w: 100 },
        { label: 'Saat',   value: opts.examStartsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), x: margin + 270, w: 80 },
      ];
      const subtitles = (opts.subtitleLines ?? [])
        .flatMap((r) => r.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean));
      const dersLine = subtitles.find((l) => /ders\s*\/\s*s[iı]nav/i.test(l));
      const saatDersLine = subtitles.find((l) => /saat\s*\/\s*ders/i.test(l));
      if (dersLine) {
        cols.push({
          label: 'Ders',
          value: dersLine.replace(/^[^:]+:\s*/, '').trim(),
          x: margin + 355,
          w: contentW - 315,
        });
      }
      if (saatDersLine) {
        const periodVal = saatDersLine.replace(/^[^:]+:\s*/, '').trim();
        const saatCol = cols.find((c) => c.label === 'Saat');
        if (saatCol && periodVal && !String(saatCol.value).includes(periodVal)) {
          saatCol.value = `${String(saatCol.value).trim()}  •  ${periodVal}`;
        }
      }

      const innerPad = 4;
      const labelSize = 6.5;
      const valueSize = 7.5;
      const lineGap = 9;
      const colLines = cols.map((col) =>
        fitLines(String(col.value ?? '—'), fontBold, valueSize, Math.max(20, col.w - innerPad * 2), 3),
      );
      const maxLines = Math.max(1, ...colLines.map((l) => l.length));
      const dynBoxH = 6 + labelSize + maxLines * lineGap;
      for (let ci = 0; ci < cols.length; ci++) {
        const col = cols[ci];
        const lines = colLines[ci];
        page.drawRectangle({
          x: col.x,
          y: y - dynBoxH + 4,
          width: col.w - 4,
          height: dynBoxH,
          color: rgb(0.96, 0.97, 1),
          borderColor: rgb(0.82, 0.85, 0.92),
          borderWidth: 0.5,
        });
        page.drawText(col.label, { x: col.x + innerPad, y: y - 1, size: labelSize, font, color: rgb(0.45, 0.45, 0.55) });
        let ly = y - 10;
        for (const ln of lines) {
          page.drawText(ln, { x: col.x + innerPad, y: ly, size: valueSize, font: fontBold, color: rgb(0.1, 0.15, 0.4) });
          ly -= lineGap;
        }
      }
      y -= dynBoxH + 8;

      if (opts.proctorNames !== undefined) {
        const gozLabel = 'Gözetmen(ler)';
        const gozBody =
          opts.proctorNames.length > 0
            ? opts.proctorNames.map((n, i) => `${i + 1}. ${n}`).join('   ')
            : '—';
        const gozLines = fitLines(gozBody, opts.proctorNames.length ? fontBold : font, 7.2, contentW - 12, 4);
        const gozBoxH = 8 + 6.5 + gozLines.length * 10 + 4;
        page.drawRectangle({
          x: margin,
          y: y - gozBoxH + 4,
          width: contentW,
          height: gozBoxH,
          color: rgb(0.97, 0.98, 1),
          borderColor: rgb(0.78, 0.82, 0.9),
          borderWidth: 0.45,
        });
        page.drawText(gozLabel, { x: margin + 6, y: y - 2, size: 6.5, font, color: rgb(0.42, 0.44, 0.52) });
        let gy = y - 12;
        for (const ln of gozLines) {
          page.drawText(ln, { x: margin + 6, y: gy, size: 7.2, font: opts.proctorNames.length ? fontBold : font, color: rgb(0.08, 0.1, 0.28) });
          gy -= 10;
        }
        y -= gozBoxH + 8;
      }

      // ── Tablo başlığı ───────────────────────────────────────────────────
      page.drawRectangle({
        x: margin, y: y - 12, width: contentW, height: 16,
        color: rgb(0.92, 0.94, 0.98),
        borderColor: rgb(0.78, 0.82, 0.9),
        borderWidth: 0.4,
      });
      page.drawText('#',     { x: margin + 4,   y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('İsim',  { x: margin + 22,  y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('Sınıf', { x: margin + 210, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('No',    { x: margin + 300, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('Sıra',  { x: margin + 370, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('İmza',  { x: margin + 420, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      y -= 20;
    };

    header();

    const colNameX = margin + 22;
    const colClassX = margin + 210;
    const colNoX = margin + 300;
    const colSeatX = margin + 370;
    const nameMaxW = colClassX - colNameX - 4;
    const classMaxW = colNoX - colClassX - 4;
    const noMaxW = colSeatX - colNoX - 4;
    const rowFontSize = 7.5;
    const rowLineGap = 9;

    for (let ri = 0; ri < opts.rows.length; ri++) {
      const row = opts.rows[ri];
      const nameLines = fitLines(row.studentName, font, rowFontSize, nameMaxW, 3);
      const classLines = fitLines(row.classLabel, font, rowFontSize, classMaxW, 2);
      const noLines = fitLines(String(row.studentNumber ?? '—'), font, rowFontSize, noMaxW, 1);
      const lineCount = Math.max(nameLines.length, classLines.length, noLines.length, 1);
      const rowH = Math.max(13, 4 + lineCount * rowLineGap);

      if (y < rowH + 56) {
        newPage();
        header();
      }
      const rowBg = ri % 2 === 1 ? rgb(0.97, 0.97, 1) : rgb(1, 1, 1);
      const rowTop = y + 3;
      page.drawRectangle({ x: margin, y: rowTop - rowH, width: pageW - margin * 2, height: rowH, color: rowBg });
      page.drawText(String(ri + 1), { x: margin + 4, y: rowTop - 10, size: rowFontSize, font, color: rgb(0.55, 0.55, 0.6) });
      let ny = rowTop - 10;
      for (const ln of nameLines) {
        page.drawText(ln, { x: colNameX, y: ny, size: rowFontSize, font });
        ny -= rowLineGap;
      }
      ny = rowTop - 10;
      for (const ln of classLines) {
        page.drawText(ln, { x: colClassX, y: ny, size: rowFontSize, font });
        ny -= rowLineGap;
      }
      ny = rowTop - 10;
      for (const ln of noLines) {
        page.drawText(ln, { x: colNoX, y: ny, size: rowFontSize, font });
        ny -= rowLineGap;
      }
      page.drawText(row.seatLabel, { x: colSeatX, y: rowTop - 10, size: rowFontSize, font: fontBold, color: rgb(0.1, 0.15, 0.45) });
      page.drawRectangle({
        x: margin + 418,
        y: rowTop - rowH,
        width: pageW - margin * 2 - 378,
        height: rowH,
        borderColor: rgb(0.85, 0.87, 0.93),
        borderWidth: 0.4,
      });
      y = rowTop - rowH - 2;
    }

    if (opts.footerLines?.length) {
      y -= 12;
      if (y < 120) {
        newPage();
        y = pageH - margin;
      }
      page.drawText('Açıklama', { x: margin, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.35) });
      y -= 14;
      for (const raw of opts.footerLines) {
        const parts = raw.length > 95 ? chunkText(raw, 95) : [raw];
        for (const part of parts) {
          if (y < 56) {
            newPage();
            y = pageH - margin;
          }
          page.drawText(part, { x: margin, y, size: 7, font, color: rgb(0.25, 0.25, 0.28) });
          y -= 12;
        }
      }
    }

    return doc.save();
  }

  /** Tüm salonlar için gözetmen özet listesi (tek PDF). */
  async buildProctorsListPdf(opts: {
    title: string;
    schoolName: string;
    examStartsAt: Date;
    rows: Array<{ buildingName: string; roomName: string; proctorNames: string[] }>;
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    const pageW = 595;
    const pageH = 842;
    const margin = 40;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;
    const contentW = pageW - margin * 2;
    const colSalonW = 200;
    const nameColX = margin + colSalonW + 8;
    const nameMaxW = pageW - margin - nameColX - 4;

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    };

    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentW,
      height: 20,
      color: rgb(0.12, 0.22, 0.48),
    });
    page.drawText(opts.schoolName, { x: margin + 6, y: y - 11, size: 9, font, color: rgb(1, 1, 1) });
    y -= 28;
    page.drawText('Gözetmen listesi', { x: margin, y, size: 14, font: fontBold, color: rgb(0.1, 0.15, 0.45) });
    y -= 8;
    page.drawText(opts.title, { x: margin, y, size: 9, font, color: rgb(0.35, 0.38, 0.48) });
    y -= 12;
    const wh = `${opts.examStartsAt.toLocaleDateString('tr-TR')} ${opts.examStartsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    page.drawText(wh, { x: margin, y, size: 8, font, color: rgb(0.4, 0.42, 0.5) });
    y -= 22;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: rgb(0.12, 0.22, 0.48) });
    y -= 16;

    if (!opts.rows.length) {
      page.drawText('Bu sınav için tanımlı salon veya gözetmen kaydı bulunmuyor.', {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0.45, 0.45, 0.52),
      });
      return doc.save();
    }

    const drawColumnHeaders = () => {
      page.drawRectangle({
        x: margin,
        y: y - 12,
        width: contentW,
        height: 16,
        color: rgb(0.92, 0.94, 0.98),
        borderColor: rgb(0.78, 0.82, 0.9),
        borderWidth: 0.4,
      });
      page.drawText('#', { x: margin + 6, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('Salon', { x: margin + 28, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      page.drawText('Gözetmen(ler)', { x: nameColX, y: y - 8, size: 7.5, font: fontBold, color: rgb(0.2, 0.2, 0.4) });
      y -= 22;
    };

    drawColumnHeaders();

    const salonMaxW = colSalonW - 36;
    for (let ri = 0; ri < opts.rows.length; ri++) {
      const row = opts.rows[ri];
      const salonStr = `${row.buildingName ? `${row.buildingName} / ` : ''}${row.roomName}`.trim() || '—';
      const salonLines = fitLines(salonStr, font, 7.2, salonMaxW, 3);
      const gozStr =
        row.proctorNames.length > 0 ? row.proctorNames.map((n, i) => `${i + 1}. ${n}`).join('   ') : '—';
      const gozLines = fitLines(gozStr, row.proctorNames.length ? fontBold : font, 7.2, nameMaxW, 8);
      const lineCount = Math.max(salonLines.length, gozLines.length, 1);
      const rowH = Math.max(16, 6 + lineCount * 10);

      if (y < rowH + 48) {
        newPage();
        drawColumnHeaders();
      }
      const rowTop = y + 3;
      page.drawRectangle({ x: margin, y: rowTop - rowH, width: contentW, height: rowH, color: ri % 2 === 1 ? rgb(0.97, 0.97, 1) : rgb(1, 1, 1) });
      page.drawText(String(ri + 1), { x: margin + 6, y: rowTop - 10, size: 7.2, font, color: rgb(0.5, 0.5, 0.58) });
      let sy = rowTop - 10;
      for (const ln of salonLines) {
        page.drawText(ln, { x: margin + 28, y: sy, size: 7.2, font, color: rgb(0.12, 0.14, 0.32) });
        sy -= 10;
      }
      let ny = rowTop - 10;
      for (const ln of gozLines) {
        page.drawText(ln, { x: nameColX, y: ny, size: 7.2, font: row.proctorNames.length ? fontBold : font, color: rgb(0.06, 0.08, 0.22) });
        ny -= 10;
      }
      y = rowTop - rowH - 2;
    }

    return doc.save();
  }

  /**
   * Sınav Takvimi — MEB resmi yazı düzeni:
   *   T.C. / İl-İlçe / Okul Müdürlüğü / Eğitim-Öğretim Yılı / başlık → çerçeveli tablo →
   *   numaralı açıklamalar → sayfa altında "Düzenleyen / Onaylayan" imza bloğu.
   */
  async buildExamSchedulePdf(opts: {
    periodTitle: string;
    subtitle: string;
    schoolName: string;
    cityLine?: string;
    academicYear?: string;
    rows: Array<{
      sn: number;
      gun: string;
      tarih: string;
      saat: string;
      sinavDersi: string;
      aciklama?: string;
      subeler?: string;
    }>;
    footerLines?: string[];
    duzenleyen?: { name: string; title: string };
    onaylayan?: { name: string; title: string };
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const pageW = 595;
    const pageH = 842;
    const margin = 56;
    const contentW = pageW - margin * 2;
    const page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const ink = rgb(0.08, 0.08, 0.1);
    const muted = rgb(0.32, 0.32, 0.36);
    const ruleColor = rgb(0.18, 0.22, 0.32);
    const headBg = rgb(0.92, 0.94, 0.98);
    const headBorder = rgb(0.62, 0.66, 0.76);
    const bodyBorder = rgb(0.78, 0.82, 0.9);

    const drawCentered = (text: string, size: number, bold = false, color = ink, lineGap = 3) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (pageW - w) / 2, y, size, font: f, color });
      y -= size + lineGap;
    };

    // ─── 1) Resmî başlık bloğu (merkezli) ──────────────────────────
    drawCentered('T.C.', 11, true, ink, 4);
    if (opts.cityLine) {
      for (const raw of opts.cityLine.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean)) {
        drawCentered(raw.toLocaleUpperCase('tr-TR'), 10, true, ink, 3);
      }
    }
    drawCentered((opts.schoolName || 'OKUL MÜDÜRLÜĞÜ').toLocaleUpperCase('tr-TR'), 11, true, ink, 4);
    if (opts.academicYear) drawCentered(opts.academicYear, 10, false, muted, 2);
    y -= 6;

    // ─── 2) Belge başlığı ──────────────────────────────────────────
    const docTitle = `${opts.periodTitle} — ${opts.subtitle}`.toLocaleUpperCase('tr-TR');
    drawCentered(docTitle, 11, true, ink, 4);
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: ruleColor });
    y -= 14;

    // ─── 3) Tablo kolon planı ──────────────────────────────────────
    const hasSubeler = opts.rows.some((r) => r.subeler);
    // Genişlik dağılımı (toplam contentW). Şubeler sütunu dar kalırsa virgüllü liste taşar — dersi biraz sıkıp şubelere / açıklamaya oran ver.
    const widths = hasSubeler
      ? { sn: 28, gun: 54, tarih: 62, saat: 56, ders: 100, subeler: 0, aciklama: 0 }
      : { sn: 28, gun: 60, tarih: 70, saat: 64, ders: 130, subeler: 0, aciklama: 0 };
    if (hasSubeler) {
      const remaining = contentW - (widths.sn + widths.gun + widths.tarih + widths.saat + widths.ders);
      widths.subeler = Math.round(remaining * 0.58);
      widths.aciklama = remaining - widths.subeler;
    } else {
      widths.aciklama = contentW - (widths.sn + widths.gun + widths.tarih + widths.saat + widths.ders);
    }
    let cx = margin;
    const colX = {
      sn: cx, gun: (cx += widths.sn), tarih: (cx += widths.gun), saat: (cx += widths.tarih),
      ders: (cx += widths.saat), subeler: hasSubeler ? (cx += widths.ders) : 0,
      aciklama: hasSubeler ? (cx += widths.subeler) : (cx += widths.ders),
    };
    const colW = widths;
    const cellPadX = 4;
    const cellPadY = 4;
    const rowFontSize = 8;
    const rowLineH = 10;
    const subeMaxLines = 5;

    const drawCellText = (
      text: string,
      x: number,
      yTop: number,
      maxW: number,
      maxLines: number,
      bold = false,
      color = ink,
    ): number => {
      const f = bold ? fontBold : font;
      const lines = fitLines(text, f, rowFontSize, Math.max(16, maxW), maxLines);
      let ly = yTop - cellPadY - rowFontSize + 1;
      for (const ln of lines) {
        page.drawText(ln, { x: x + cellPadX, y: ly, size: rowFontSize, font: f, color });
        ly -= rowLineH;
      }
      return Math.max(1, lines.length);
    };

    // ─── 4) Tablo başlığı (gri zemin, çerçeveli) ──────────────────
    const headH = 18;
    page.drawRectangle({ x: margin, y: y - headH, width: contentW, height: headH, color: headBg, borderColor: headBorder, borderWidth: 0.6 });
    const drawHeaderCell = (label: string, x: number, w: number) => {
      const tw = fontBold.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: x + Math.max(cellPadX, (w - tw) / 2), y: y - 12, size: 8, font: fontBold, color: ink });
      page.drawLine({ start: { x: x + w, y: y - headH }, end: { x: x + w, y }, thickness: 0.5, color: headBorder });
    };
    drawHeaderCell('S.No', colX.sn, colW.sn);
    drawHeaderCell('Gün', colX.gun, colW.gun);
    drawHeaderCell('Tarih', colX.tarih, colW.tarih);
    drawHeaderCell('Saat', colX.saat, colW.saat);
    drawHeaderCell('Sınav Dersi', colX.ders, colW.ders);
    if (hasSubeler) drawHeaderCell('Şubeler', colX.subeler, colW.subeler);
    drawHeaderCell('Açıklama', colX.aciklama, colW.aciklama);
    y -= headH;

    // ─── 5) Satırlar ──────────────────────────────────────────────
    for (const row of opts.rows) {
      // İçerik yüksekliğini tahmin et
      const dersLines = fitLines(row.sinavDersi, fontBold, rowFontSize, Math.max(20, colW.ders - cellPadX * 2), 4).length;
      const subeLines = hasSubeler && row.subeler ? fitLines(row.subeler, font, rowFontSize, Math.max(20, colW.subeler - cellPadX * 2), subeMaxLines).length : 1;
      const acikLines = row.aciklama ? fitLines(row.aciklama, font, rowFontSize, Math.max(20, colW.aciklama - cellPadX * 2), 3).length : 1;
      const lineCount = Math.max(1, dersLines, subeLines, acikLines);
      const rowH = cellPadY * 2 + lineCount * rowLineH;

      // İmza ve dipnot için ~150 pt rezerv; sığmazsa kalanları yeni sayfa yerine kes
      if (y - rowH < margin + 160) break;

      const rowTop = y;
      // Hücre çerçevesi (tüm satır)
      page.drawRectangle({ x: margin, y: rowTop - rowH, width: contentW, height: rowH, borderColor: bodyBorder, borderWidth: 0.4 });
      // Dikey ayırıcılar
      for (const x of [colX.gun, colX.tarih, colX.saat, colX.ders, ...(hasSubeler ? [colX.subeler] : []), colX.aciklama]) {
        page.drawLine({ start: { x, y: rowTop - rowH }, end: { x, y: rowTop }, thickness: 0.4, color: bodyBorder });
      }

      // Hücreler
      drawCellText(String(row.sn), colX.sn, rowTop, colW.sn - cellPadX * 2, 1);
      drawCellText(row.gun, colX.gun, rowTop, colW.gun - cellPadX * 2, 1);
      drawCellText(row.tarih, colX.tarih, rowTop, colW.tarih - cellPadX * 2, 1);
      drawCellText(row.saat, colX.saat, rowTop, colW.saat - cellPadX * 2, 1);
      drawCellText(row.sinavDersi, colX.ders, rowTop, colW.ders - cellPadX * 2, 4, true);
      if (hasSubeler) drawCellText(row.subeler ?? '', colX.subeler, rowTop, colW.subeler - cellPadX * 2, subeMaxLines, false, muted);
      drawCellText(row.aciklama ?? '', colX.aciklama, rowTop, colW.aciklama - cellPadX * 2, 3, false, muted);

      y = rowTop - rowH;
    }

    // ─── 6) Açıklamalar (numaralı) ───────────────────────────────
    if (opts.footerLines?.length) {
      y -= 14;
      page.drawText('AÇIKLAMALAR', { x: margin, y, size: 9, font: fontBold, color: ink });
      y -= 12;
      let n = 1;
      for (const raw of opts.footerLines) {
        const prefix = `${n}. `;
        const prefixW = fontBold.widthOfTextAtSize(prefix, 8);
        const lines = fitLines(raw, font, 8, contentW - prefixW - 2, 4);
        if (!lines.length) { n += 1; continue; }
        page.drawText(prefix, { x: margin, y, size: 8, font: fontBold, color: ink });
        let ly = y;
        for (let i = 0; i < lines.length; i++) {
          page.drawText(lines[i], { x: margin + prefixW, y: ly, size: 8, font, color: muted });
          ly -= 11;
        }
        y = ly - 2;
        n += 1;
        if (y < margin + 110) break;
      }
    }

    // ─── 7) İmza bloğu (sayfa altında, iki sütun) ────────────────
    if (opts.duzenleyen || opts.onaylayan) {
      const sigBaseY = Math.max(margin + 78, Math.min(y - 26, margin + 110));
      const colWidth = (contentW - 40) / 2;
      const drawSig = (sig: { name: string; title: string }, x: number) => {
        // Boş imza alanı çizgisi
        const labelY = sigBaseY + 56;
        const lineY = sigBaseY + 26;
        const w = colWidth;
        // Başlık
        const lbl = 'İmza';
        const lblW = font.widthOfTextAtSize(lbl, 8);
        page.drawText(lbl, { x: x + (w - lblW) / 2, y: labelY, size: 8, font, color: muted });
        // İmza çizgisi
        page.drawLine({ start: { x: x + 20, y: lineY }, end: { x: x + w - 20, y: lineY }, thickness: 0.6, color: bodyBorder });
        // Ad
        const nameUp = (sig.name || '').toLocaleUpperCase('tr-TR');
        const nameW = fontBold.widthOfTextAtSize(nameUp, 10);
        page.drawText(nameUp, { x: x + (w - nameW) / 2, y: lineY - 14, size: 10, font: fontBold, color: ink });
        // Unvan
        if (sig.title) {
          const titleW = font.widthOfTextAtSize(sig.title, 9);
          page.drawText(sig.title, { x: x + (w - titleW) / 2, y: lineY - 26, size: 9, font, color: muted });
        }
      };
      // Üst etiket (Düzenleyen / Onaylayan)
      const labelTopY = sigBaseY + 70;
      if (opts.duzenleyen) {
        const lbl = 'Düzenleyen';
        const lblW = fontBold.widthOfTextAtSize(lbl, 9);
        page.drawText(lbl, { x: margin + (colWidth - lblW) / 2, y: labelTopY, size: 9, font: fontBold, color: ink });
        drawSig(opts.duzenleyen, margin);
      }
      if (opts.onaylayan) {
        const lbl = 'Onaylayan';
        const lblW = fontBold.widthOfTextAtSize(lbl, 9);
        const x2 = margin + colWidth + 40;
        page.drawText(lbl, { x: x2 + (colWidth - lblW) / 2, y: labelTopY, size: 9, font: fontBold, color: ink });
        drawSig(opts.onaylayan, x2);
      }
    }

    return doc.save();
  }

  /** Sınav kağıdı — examPaperConfig ile özel alanlar + QR köşesi; yoksa klasik üst şerit + şablon PDF */
  async buildExamPaperLabelsPdf(opts: {
    planTitle: string;
    schoolName: string;
    examStartsAt: Date;
    subjectLabel?: string;
    examPdfBuffer?: Buffer;
    examPdfBySubject?: Record<string, Buffer>;
    examPaperConfig?: {
      pageCount: number;
      usedPageCount: number;
      paperMode?: 'custom' | 'template';
      showQrCode?: boolean;
      qrCorner?: 'tl' | 'tr' | 'bl' | 'br';
      fields: Array<{
        fieldType: 'studentName' | 'studentNumber' | 'className' | 'attendance';
        label: string;
        pageIndex: number;
        xPct: number;
        yPct: number;
      }>;
    };
    rooms: Array<{
      roomName: string;
      buildingName: string;
      students: Array<{
        studentName: string;
        studentNumber: string | null;
        classLabel: string;
        seatLabel: string;
        subjectName?: string;
      }>;
    }>;
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font     = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const pageW = 595;
    const pageH = 842;
    const m     = 28; // margin

    // Yüklenen sınav PDF — ders adına göre cache
    type SrcDoc = Awaited<ReturnType<typeof PDFDocument.load>>;
    const srcDocBySubject = new Map<string, SrcDoc>();
    const loadSrc = async (buf?: Buffer): Promise<SrcDoc | null> => {
      if (!buf?.length) return null;
      try { return await PDFDocument.load(buf); } catch { return null; }
    };
    let fallbackSrc: SrcDoc | null = await loadSrc(opts.examPdfBuffer);
    if (opts.examPdfBySubject) {
      for (const [subj, buf] of Object.entries(opts.examPdfBySubject)) {
        const d = await loadSrc(buf);
        if (d) srcDocBySubject.set(subj, d);
      }
    }
    const pickSrc = (subjectName?: string): SrcDoc | null => {
      const key = (subjectName ?? '').trim();
      if (key && srcDocBySubject.has(key)) return srcDocBySubject.get(key)!;
      return fallbackSrc;
    };

    const allStudents: Array<{
      roomName: string; buildingName: string;
      studentName: string; studentNumber: string | null;
      classLabel: string; seatLabel: string; subjectName?: string;
    }> = [];
    for (const room of opts.rooms) {
      for (const s of room.students) {
        allStudents.push({ roomName: room.roomName, buildingName: room.buildingName, ...s });
      }
    }

    const cfg = opts.examPaperConfig;
    const showQrCode = cfg ? cfg.showQrCode !== false : true;
    const qrCorner: 'tl' | 'tr' | 'bl' | 'br' =
      cfg?.qrCorner === 'tl' || cfg?.qrCorner === 'tr' || cfg?.qrCorner === 'bl' || cfg?.qrCorner === 'br'
        ? cfg.qrCorner
        : 'tr';
    const customFields = cfg?.fields?.length ? cfg.fields : [];
    const useCustomLayout = customFields.length > 0;

    const effectiveUsedPages = (src: SrcDoc | null): number => {
      const wantRaw = typeof cfg?.usedPageCount === 'number' && cfg.usedPageCount > 0 ? cfg.usedPageCount : 999;
      const pageCapRaw = typeof cfg?.pageCount === 'number' && cfg.pageCount > 0 ? cfg.pageCount : wantRaw;
      const want = Math.max(1, wantRaw);
      const pageCap = Math.max(1, pageCapRaw);
      const sc = src?.getPageCount() ?? 0;
      if (sc <= 0) return Math.max(1, Math.min(want, pageCap));
      return Math.max(1, Math.min(want, pageCap, sc));
    };

    // QR kodu önceden üret (tüm öğrenciler için)
    const qrCache = new Map<string, Buffer>();
    const getQr = async (data: string): Promise<Buffer | null> => {
      if (qrCache.has(data)) return qrCache.get(data)!;
      try {
        const buf = await QRCode.toBuffer(data, { type: 'png', width: 96, margin: 1 });
        qrCache.set(data, buf);
        return buf;
      } catch { return null; }
    };

    const drawCornerQr = async (
      page: ReturnType<typeof doc.addPage>,
      s: (typeof allStudents)[0],
      suppressTopCorner?: boolean,
    ) => {
      if (!showQrCode) return;
      if (suppressTopCorner && (qrCorner === 'tr' || qrCorner === 'tl')) return;
      const qrData = [s.studentNumber, s.studentName, s.classLabel, s.seatLabel, s.roomName].filter(Boolean).join('|');
      const qrBuf = await getQr(qrData);
      if (!qrBuf) return;
      const qrImg = await doc.embedPng(qrBuf);
      const qrRel = Math.min(58, Math.round(0.1 * Math.min(pageW, pageH)));
      const pad = 5;
      let x = m + pad;
      let y = m + pad;
      if (qrCorner === 'tr') {
        x = pageW - m - qrRel - pad;
        y = pageH - m - qrRel - pad;
      } else if (qrCorner === 'tl') {
        x = m + pad;
        y = pageH - m - qrRel - pad;
      } else if (qrCorner === 'br') {
        x = pageW - m - qrRel - pad;
        y = m + pad;
      } else {
        x = m + pad;
        y = m + pad;
      }
      page.drawImage(qrImg, { x, y, width: qrRel, height: qrRel });
    };

    const fieldPlainValue = (
      ft: 'studentName' | 'studentNumber' | 'className' | 'attendance',
      s: (typeof allStudents)[0],
    ): string => {
      if (ft === 'studentName') return s.studentName || '—';
      if (ft === 'studentNumber') return String(s.studentNumber ?? '—');
      if (ft === 'className') return s.classLabel || '—';
      return `Sıra ${s.seatLabel} · ${s.buildingName ? `${s.buildingName} / ` : ''}${s.roomName}`;
    };

    const drawCustomOverlays = (
      page: ReturnType<typeof doc.addPage>,
      s: (typeof allStudents)[0],
      pageIndex: number,
      hideIdentityFields?: boolean,
    ) => {
      const contentW = pageW - 2 * m;
      const contentH = pageH - 2 * m;
      const skipId = hideIdentityFields && pageIndex === 0;
      for (const f of customFields.filter((x) => (x.pageIndex ?? 0) === pageIndex)) {
        if (skipId && (f.fieldType === 'studentName' || f.fieldType === 'studentNumber' || f.fieldType === 'className')) {
          continue;
        }
        const leftX = m + (f.xPct / 100) * contentW;
        const yCenter = (pageH - m) - (f.yPct / 100) * contentH;
        const maxW = Math.min(240, Math.max(40, pageW - m - leftX - 4));
        const val = fieldPlainValue(f.fieldType, s);
        page.drawText(f.label, { x: leftX, y: yCenter + 12, size: 6, font, color: rgb(0.4, 0.4, 0.48) });
        const lines = fitLines(val, fontBold, 9, maxW, 5);
        let ly = yCenter - 2;
        for (const ln of lines) {
          page.drawText(ln, { x: leftX, y: ly, size: 9, font: fontBold, color: rgb(0.06, 0.1, 0.28) });
          ly -= 11;
        }
      }
    };

    type HeaderEmbeddedQr = { img: PDFImage; drawSize: number } | null;
    const loadHeaderEmbeddedQr = async (s: (typeof allStudents)[0]): Promise<HeaderEmbeddedQr> => {
      if (!showQrCode || (qrCorner !== 'tr' && qrCorner !== 'tl')) return null;
      const qrData = [s.studentNumber, s.studentName, s.classLabel, s.seatLabel, s.roomName].filter(Boolean).join('|');
      const qrBuf = await getQr(qrData);
      if (!qrBuf) return null;
      const img = await doc.embedPng(qrBuf);
      const drawSize = Math.min(40, Math.round(0.066 * Math.min(pageW, pageH)));
      return { img, drawSize };
    };

    /**
     * Kompakt üst şerit — metin QR ile çakışmaz; ders adı (salon değil), sıra vurgulu, taşma yok.
     */
    const drawFormalCompactHeader = async (
      page: ReturnType<typeof doc.addPage>,
      s: (typeof allStudents)[0],
      embedded: HeaderEmbeddedQr,
    ): Promise<{ bandBot: number; suppressCornerQr: boolean }> => {
      const inkT = rgb(0.05, 0.07, 0.11);
      const muted = rgb(0.42, 0.44, 0.5);
      const border = rgb(0.72, 0.74, 0.82);
      const bandTop = pageH - m;
      const useHeaderQr = !!embedded && showQrCode && (qrCorner === 'tr' || qrCorner === 'tl');
      const qrDraw = useHeaderQr ? embedded!.drawSize : 0;
      const qPad = 5;
      const qrColW = useHeaderQr ? qrDraw + qPad * 2 + 6 : 8;
      const padX = 12;
      const innerL = m + padX;
      const innerR = pageW - m - qrColW - 2;
      const textW = Math.max(100, innerR - innerL);
      const headerBandH = useHeaderQr ? Math.max(46, qrDraw + qPad * 2 + 8) : 42;
      const bandBot = bandTop - headerBandH;
      const boxW = pageW - 2 * m;

      page.drawRectangle({
        x: m,
        y: bandBot,
        width: boxW,
        height: headerBandH,
        color: rgb(0.993, 0.995, 1),
        borderColor: border,
        borderWidth: 0.45,
      });

      let ty = bandTop - 8;
      const schoolUp = (opts.schoolName?.trim() || 'OKUL').toLocaleUpperCase('tr-TR');
      page.drawText(truncateToWidth(schoolUp, fontBold, 7.4, textW), {
        x: innerL,
        y: ty,
        size: 7.4,
        font: fontBold,
        color: inkT,
      });

      ty -= 10;
      const titleLine = truncateToWidth(opts.planTitle.trim() || 'Sınav', fontBold, 7.2, textW);
      page.drawText(titleLine, { x: innerL, y: ty, size: 7.2, font: fontBold, color: rgb(0.1, 0.12, 0.2) });

      ty -= 10;
      const when = `${opts.examStartsAt.toLocaleDateString('tr-TR')} ${opts.examStartsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      const dersRaw = ((s.subjectName ?? '').trim() || (opts.subjectLabel ?? '').trim() || '—').replace(/\s+/g, ' ');
      const seatSize = 8.6;
      const seatStrFull = `Sıra ${String(s.seatLabel ?? '').trim() || '—'}`;
      const seatMaxW = Math.min(120, Math.max(52, textW * 0.34));
      const seatDisplay = truncateToWidth(seatStrFull, fontBold, seatSize, seatMaxW);
      const seatW = fontBold.widthOfTextAtSize(seatDisplay, seatSize);
      const metaGap = 10;
      const leftMax = Math.max(40, textW - seatW - metaGap);
      const metaLeft = truncateToWidth(`${when}  ·  ${dersRaw}`, font, 6.4, leftMax);
      page.drawText(metaLeft, { x: innerL, y: ty, size: 6.4, font, color: muted });
      page.drawText(seatDisplay, {
        x: innerR - seatW,
        y: ty - 0.5,
        size: seatSize,
        font: fontBold,
        color: rgb(0.02, 0.04, 0.1),
      });

      ty -= 11;
      const idLine = truncateToWidth(
        `${s.studentName || '—'}   ·   No ${String(s.studentNumber ?? '—')}   ·   ${(s.classLabel || '—').replace(/\s+/g, ' ')}`,
        fontBold,
        7,
        textW,
      );
      page.drawText(idLine, { x: innerL, y: ty, size: 7, font: fontBold, color: inkT });

      if (useHeaderQr && embedded) {
        const ix = qrCorner === 'tr' ? pageW - m - qrDraw - qPad : m + qPad;
        const iy = bandTop - qPad - qrDraw;
        page.drawImage(embedded.img, { x: ix, y: iy, width: qrDraw, height: qrDraw });
      }

      return { bandBot, suppressCornerQr: useHeaderQr };
    };

    /** Devam sayfaları — tek satır ince şerit */
    const drawContinuationStrip = (page: ReturnType<typeof doc.addPage>, pageIndex1: number): number => {
      const contentW = pageW - 2 * m;
      const stripH = 13;
      const bandTop = pageH - m;
      const stripBot = bandTop - stripH;
      page.drawRectangle({
        x: m,
        y: stripBot,
        width: contentW,
        height: stripH,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.62, 0.64, 0.72),
        borderWidth: 0.3,
      });
      const seg = truncateToWidth(
        `${(opts.schoolName || '').trim()} · ${opts.planTitle.trim()} · Sayfa ${pageIndex1}`,
        font,
        6.6,
        contentW - 10,
      );
      page.drawText(seg, { x: m + 4, y: bandTop - 4, size: 6.6, font, color: rgb(0.36, 0.37, 0.44) });
      return stripBot;
    };

    const drawYaziliPlaceholder = (page: ReturnType<typeof doc.addPage>, headerBottom: number) => {
      const bottom = m;
      const topInner = headerBottom - 6;
      const h = Math.max(80, topInner - bottom);
      page.drawRectangle({
        x: m + 1,
        y: bottom,
        width: pageW - (m + 1) * 2,
        height: h,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.82, 0.84, 0.9),
        borderWidth: 0.75,
      });
    };

    // ── Her öğrenci ───────────────────────────────────────────────────
    if (!allStudents.length) {
      const page = doc.addPage([pageW, pageH]);
      page.drawText('Bu sınav için yerleştirilmiş öğrenci yok.', {
        x: m,
        y: pageH / 2,
        size: 11,
        font,
        color: rgb(0.35, 0.35, 0.4),
      });
      return doc.save();
    }

    for (const s of allStudents) {
      const examSrcDoc = pickSrc(s.subjectName);
      const customThisStudent = useCustomLayout && !!examSrcDoc;
      const headerQr = await loadHeaderEmbeddedQr(s);

      if (customThisStudent) {
        const usedN = effectiveUsedPages(examSrcDoc);
        for (let pi = 0; pi < usedN; pi++) {
          const page = doc.addPage([pageW, pageH]);
          const contentW = pageW - 2 * m;
          const innerBottom = m + 4;
          let embedTopY = pageH - m;
          let suppressCorner = false;
          if (pi === 0) {
            const h = await drawFormalCompactHeader(page, s, headerQr);
            embedTopY = h.bandBot - 3;
            suppressCorner = h.suppressCornerQr;
          } else {
            embedTopY = drawContinuationStrip(page, pi + 1) - 2;
          }
          const availH = Math.max(48, embedTopY - innerBottom);
          const availW = contentW;
          if (examSrcDoc && pi < examSrcDoc.getPageCount()) {
            const sp = examSrcDoc.getPage(pi);
            const dims = sp.getSize();
            const scale = Math.min(availW / dims.width, availH / dims.height);
            const drawW = dims.width * scale;
            const drawH = dims.height * scale;
            const drawX = m + (availW - drawW) / 2;
            const drawY = innerBottom + (availH - drawH) / 2;
            const emb = await doc.embedPage(sp);
            page.drawPage(emb, { x: drawX, y: drawY, width: drawW, height: drawH });
          } else {
            page.drawRectangle({
              x: m,
              y: innerBottom,
              width: contentW,
              height: availH,
              color: rgb(1, 1, 1),
              borderColor: rgb(0.82, 0.84, 0.9),
              borderWidth: 0.5,
            });
          }
          drawCustomOverlays(page, s, pi, true);
          await drawCornerQr(page, s, suppressCorner);
        }
        continue;
      }

      /* Klasik düzen */
      if (examSrcDoc) {
        const examPageCount = examSrcDoc.getPageCount();
        const usedN = effectiveUsedPages(examSrcDoc);

        const page1 = doc.addPage([pageW, pageH]);
        const h1 = await drawFormalCompactHeader(page1, s, headerQr);
        const headerBottom = h1.bandBot;
        const examAvailH = headerBottom - m - 4;
        const examAvailW = pageW - m * 2;

        const srcPage0 = examSrcDoc.getPage(0);
        const srcDims = srcPage0.getSize();
        const scale = Math.min(examAvailW / srcDims.width, examAvailH / srcDims.height);
        const drawW = srcDims.width * scale;
        const drawH = srcDims.height * scale;
        const drawX = m + (examAvailW - drawW) / 2;
        const drawY = headerBottom - 4 - drawH;

        const embedded0 = await doc.embedPage(srcPage0);
        page1.drawPage(embedded0, { x: drawX, y: drawY, width: drawW, height: drawH });
        await drawCornerQr(page1, s, h1.suppressCornerQr);

        const extraEnd = Math.min(usedN - 1, examPageCount - 1);
        for (let pi = 1; pi <= extraEnd; pi++) {
          const pageN = doc.addPage([pageW, pageH]);
          const topY = drawContinuationStrip(pageN, pi + 1) - 2;
          const availH = Math.max(48, topY - (m + 4));
          const availW = pageW - m * 2;
          const sp = examSrcDoc.getPage(pi);
          const dims = sp.getSize();
          const scaleN = Math.min(availW / dims.width, availH / dims.height);
          const dW = dims.width * scaleN;
          const dH = dims.height * scaleN;
          const dX = m + (availW - dW) / 2;
          const dY = m + 4 + (availH - dH) / 2;
          const embN = await doc.embedPage(sp);
          pageN.drawPage(embN, { x: dX, y: dY, width: dW, height: dH });
          await drawCornerQr(pageN, s);
        }
      } else {
        const page1 = doc.addPage([pageW, pageH]);
        const h0 = await drawFormalCompactHeader(page1, s, headerQr);
        const headerBottom = h0.bandBot;
        drawYaziliPlaceholder(page1, headerBottom);
        await drawCornerQr(page1, s, h0.suppressCornerQr);
      }
    }

    return doc.save();
  }

}

function breakWordByWidth(word: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!word) return [];
  if (font.widthOfTextAtSize(word, size) <= maxW) return [word];
  const out: string[] = [];
  let rest = word;
  while (rest.length) {
    let lo = 1;
    let hi = rest.length;
    let best = 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = rest.slice(0, mid);
      if (font.widthOfTextAtSize(slice, size) <= maxW) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (best < 1) best = 1;
    out.push(rest.slice(0, best));
    rest = rest.slice(best);
  }
  return out;
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];
  const words = normalized.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const pieces = breakWordByWidth(w, font, size, maxW);
    for (const piece of pieces) {
      const test = cur ? `${cur} ${piece}` : piece;
      if (font.widthOfTextAtSize(test, size) <= maxW) cur = test;
      else {
        if (cur) lines.push(cur);
        cur = piece;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function fitLines(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const wrapped = wrapText(text, font, size, maxW);
  if (maxLines < 1) return [];
  if (wrapped.length <= maxLines) return wrapped;
  const head = wrapped.slice(0, maxLines);
  let last = head[maxLines - 1];
  let withEll = `${last}…`;
  while (withEll.length > 1 && font.widthOfTextAtSize(withEll, size) > maxW) {
    last = last.slice(0, -1);
    withEll = `${last}…`;
  }
  head[maxLines - 1] = withEll;
  return head;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxW: number): string {
  const t = String(text ?? '').trim();
  if (!t) return '—';
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  const ell = '…';
  let lo = 0;
  let hi = t.length;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cand = t.slice(0, mid) + ell;
    if (font.widthOfTextAtSize(cand, size) <= maxW) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best <= 0 ? ell : t.slice(0, best) + ell;
}

function chunkText(s: string, max: number): string[] {
  if (!s) return [''];
  const words = s.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.length > max ? word.slice(0, max) : word;
    } else if (current.length + 1 + word.length <= max) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word.length > max ? word.slice(0, max) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}
