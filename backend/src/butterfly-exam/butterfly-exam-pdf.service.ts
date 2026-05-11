import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
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
      // subtitleLines'dan ders/saat bilgisi: satır başı "Ders / sınav: …" veya "Saat / ders: …"
      const subtitles = (opts.subtitleLines ?? [])
        .flatMap((r) => r.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean));
      const dersSub  = subtitles.find((l) => /ders.*s[iı]nav/i.test(l)) ?? subtitles[0];
      const saatSub  = subtitles.find((l) => /saat.*ders/i.test(l))     ?? subtitles[1];
      if (dersSub) cols.push({ label: 'Ders', value: dersSub.replace(/^[^:]+:\s*/, ''), x: margin + 355, w: contentW - 315 });
      if (saatSub) {
        const periodVal = saatSub.replace(/^[^:]+:\s*/, '');
        // replace last col's w to fit, or just add period label
        const lastCol = cols[cols.length - 1];
        lastCol.value += `  •  ${periodVal}`;
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
      y -= dynBoxH + 10;

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
    // Genişlik dağılımı (toplam contentW)
    const widths = hasSubeler
      ? { sn: 28, gun: 56, tarih: 64, saat: 60, ders: 110, subeler: 0, aciklama: 0 }
      : { sn: 28, gun: 60, tarih: 70, saat: 64, ders: 130, subeler: 0, aciklama: 0 };
    if (hasSubeler) {
      const remaining = contentW - (widths.sn + widths.gun + widths.tarih + widths.saat + widths.ders);
      widths.subeler = Math.floor(remaining * 0.5);
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
      const subeLines = hasSubeler && row.subeler ? fitLines(row.subeler, font, rowFontSize, Math.max(20, colW.subeler - cellPadX * 2), 3).length : 1;
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
      if (hasSubeler) drawCellText(row.subeler ?? '', colX.subeler, rowTop, colW.subeler - cellPadX * 2, 3, false, muted);
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

  /** Sınav kağıdı — kompakt header + yüklenen PDF aynı sayfada, oda/sıra sıralamalı */
  async buildExamPaperLabelsPdf(opts: {
    planTitle: string;
    schoolName: string;
    examStartsAt: Date;
    subjectLabel?: string;
    qrCorner?: 'tl' | 'tr' | 'bl' | 'br';
    /** Ders adı bulunamazsa kullanılan yedek PDF tamponu */
    examPdfBuffer?: Buffer;
    /** Ders adına göre öğrenciye özel sınav kağıdı PDF tamponları */
    examPdfBySubject?: Record<string, Buffer>;
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

    /**
     * drawHeader — öğrenci şeridi; uzun ad/sınıf kutuya sığacak şekilde satır kırar.
     * Dönüş: header alt çizgisi (y).
     */
    const drawHeader = async (page: ReturnType<typeof doc.addPage>, s: typeof allStudents[0]) => {
      const top = pageH - m;
      const row1H = 22;
      page.drawRectangle({ x: m, y: top - row1H, width: pageW - m * 2, height: row1H, color: rgb(0.12, 0.22, 0.48) });

      const roomStr = `${s.buildingName ? s.buildingName + ' / ' : ''}${s.roomName}`;
      const seatStr = `Sıra: ${s.seatLabel}`;
      const seatW = fontBold.widthOfTextAtSize(seatStr, 10);
      const subjectForHeader = (s.subjectName ?? '').trim() || opts.subjectLabel || opts.planTitle;
      const examInfo = `${subjectForHeader}  •  ${opts.examStartsAt.toLocaleDateString('tr-TR')} ${opts.examStartsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      const roomMaxW = Math.max(40, m + 168 - (m + 5));
      const examLeft = m + 172;
      const examMaxW = Math.max(40, pageW - m - seatW - 8 - examLeft);
      page.drawText(truncateToWidth(roomStr, fontBold, 9, roomMaxW), { x: m + 5, y: top - 15, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page.drawText(truncateToWidth(examInfo, font, 7.5, examMaxW), { x: examLeft, y: top - 15, size: 7.5, font, color: rgb(0.8, 0.85, 1) });
      page.drawText(seatStr, { x: pageW - m - seatW - 5, y: top - 15, size: 10, font: fontBold, color: rgb(1, 1, 1) });

      const row2Y = top - row1H;
      const qrMax = 52;
      const infoW0 = pageW - m * 2 - qrMax - 8;
      const wName = Math.round(infoW0 * 0.52);
      const wClass = Math.round(infoW0 * 0.18);
      const wNum = infoW0 - wName - wClass;
      const nameLines = fitLines(s.studentName, fontBold, 9, Math.max(24, wName - 6), 2);
      const classLines = fitLines(s.classLabel || '—', fontBold, 9, Math.max(20, wClass - 6), 2);
      const numLines = fitLines(String(s.studentNumber ?? '—'), fontBold, 9, Math.max(20, wNum - 6), 2);
      const textLines = Math.max(nameLines.length, classLines.length, numLines.length, 1);
      const row2H = Math.max(36, 10 + textLines * 11 + 6);
      const qrSize = Math.min(qrMax, row2H - 4);
      const infoW = pageW - m * 2 - qrSize - 8;
      const boxes = [
        { label: 'Adı Soyadı', lines: nameLines, w: Math.round(infoW * 0.52) },
        { label: 'Sınıf', lines: classLines, w: Math.round(infoW * 0.18) },
        { label: 'Öğrenci No', lines: numLines, w: Math.round(infoW * 0.28) },
      ];

      page.drawRectangle({
        x: m,
        y: row2Y - row2H,
        width: pageW - m * 2,
        height: row2H,
        color: rgb(0.95, 0.96, 1),
        borderColor: rgb(0.78, 0.82, 0.9),
        borderWidth: 0.4,
      });

      const qrData = [s.studentNumber, s.studentName, s.classLabel, s.seatLabel, s.roomName].filter(Boolean).join('|');
      const qrBuf = await getQr(qrData);
      if (qrBuf) {
        const qrImg = await doc.embedPng(qrBuf);
        page.drawImage(qrImg, { x: pageW - m - qrSize - 2, y: row2Y - row2H + 2, width: qrSize, height: qrSize });
      }

      let bx = m + 3;
      const valSize = 9;
      const lineStep = 11;
      for (const b of boxes) {
        page.drawText(b.label, { x: bx, y: row2Y - 8, size: 6, font, color: rgb(0.45, 0.45, 0.55) });
        let ly = row2Y - 20;
        for (const ln of b.lines) {
          page.drawText(ln, { x: bx, y: ly, size: valSize, font: fontBold, color: rgb(0.1, 0.15, 0.4) });
          ly -= lineStep;
        }
        bx += b.w;
      }

      return top - row1H - row2H;
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
    for (const s of allStudents) {
      const examSrcDoc = pickSrc(s.subjectName);
      if (examSrcDoc) {
        const examPageCount = examSrcDoc.getPageCount();

        // Sayfa 1: header + sınav sayfası 1 embed (ölçekli)
        const page1 = doc.addPage([pageW, pageH]);
        const headerBottom = await drawHeader(page1, s);
        const examAvailH = headerBottom - m - 4; // header altından alt margin'e
        const examAvailW = pageW - m * 2;

        const srcPage0  = examSrcDoc.getPage(0);
        const srcDims   = srcPage0.getSize();
        const scale     = Math.min(examAvailW / srcDims.width, examAvailH / srcDims.height);
        const drawW     = srcDims.width  * scale;
        const drawH     = srcDims.height * scale;
        const drawX     = m + (examAvailW - drawW) / 2;
        const drawY     = headerBottom - 4 - drawH;

        const embedded0 = await doc.embedPage(srcPage0);
        page1.drawPage(embedded0, { x: drawX, y: drawY, width: drawW, height: drawH });

        // Sayfa 2+: tam boyut kopyala
        if (examPageCount > 1) {
          const rest = await doc.copyPages(examSrcDoc, Array.from({ length: examPageCount - 1 }, (_, i) => i + 1));
          for (const p of rest) doc.addPage(p);
        }
      } else {
        const page1 = doc.addPage([pageW, pageH]);
        const headerBottom = await drawHeader(page1, s);
        drawYaziliPlaceholder(page1, headerBottom);
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
