import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb } from 'pdf-lib';
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
      const boxH = 20;
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

      for (const col of cols) {
        page.drawRectangle({ x: col.x, y: y - boxH + 4, width: col.w - 4, height: boxH, color: rgb(0.96, 0.97, 1), borderColor: rgb(0.82, 0.85, 0.92), borderWidth: 0.5 });
        page.drawText(col.label, { x: col.x + 4, y: y - 1, size: 6.5, font, color: rgb(0.45, 0.45, 0.55) });
        page.drawText((col.value ?? '—').slice(0, 40), { x: col.x + 4, y: y - 11, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.4) });
      }
      y -= boxH + 10;

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

    for (let ri = 0; ri < opts.rows.length; ri++) {
      const row = opts.rows[ri];
      if (y < 72) {
        newPage();
        header();
      }
      const rowBg = ri % 2 === 1 ? rgb(0.97, 0.97, 1) : rgb(1, 1, 1);
      page.drawRectangle({ x: margin, y: y - 3, width: pageW - margin * 2, height: 13, color: rowBg });
      page.drawText(String(ri + 1), { x: margin + 4, y, size: 7.5, font, color: rgb(0.55, 0.55, 0.6) });
      page.drawText(row.studentName.slice(0, 42), { x: margin + 22, y, size: 7.5, font });
      page.drawText(row.classLabel.slice(0, 24), { x: margin + 210, y, size: 7.5, font });
      page.drawText((row.studentNumber ?? '—').slice(0, 16), { x: margin + 300, y, size: 7.5, font });
      page.drawText(row.seatLabel, { x: margin + 370, y, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.45) });
      page.drawRectangle({
        x: margin + 418, y: y - 3, width: pageW - margin * 2 - 378, height: 13,
        borderColor: rgb(0.85, 0.87, 0.93), borderWidth: 0.4,
      });
      y -= 13;
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

  /** Sınav Takvimi – list format (Images 2 & 3 style) */
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
    const margin = 50;
    const page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const centerText = (text: string, size: number, bold = false, color = rgb(0, 0, 0)) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (pageW - w) / 2, y, size, font: f, color });
      y -= size + 4;
    };

    // Header
    centerText('T.C.', 9, false, rgb(0.15, 0.15, 0.15));
    if (opts.cityLine) {
      for (const line of opts.cityLine.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean)) {
        centerText(line, 9, false, rgb(0.15, 0.15, 0.15));
      }
    }
    centerText(opts.schoolName, 10, true, rgb(0.1, 0.1, 0.1));
    if (opts.academicYear) { centerText(opts.academicYear, 9, false, rgb(0.2, 0.2, 0.2)); }
    y -= 2;
    centerText(opts.periodTitle, 10, true, rgb(0.08, 0.08, 0.4));
    centerText(opts.subtitle, 9, false, rgb(0.2, 0.2, 0.2));
    y -= 8;

    // Separator
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;

    // Table header
    const hasSubeler = opts.rows.some((r) => r.subeler);
    const cols = hasSubeler
      ? { sn: margin, gun: margin + 22, tarih: margin + 70, saat: margin + 140, ders: margin + 195, subeler: margin + 350, aciklama: margin + 460 }
      : { sn: margin, gun: margin + 22, tarih: margin + 80, saat: margin + 155, ders: margin + 215, subeler: 0, aciklama: margin + 390 };

    const hdr = (text: string, x: number) => page.drawText(text, { x, y, size: 8, font: fontBold });
    hdr('S.N', cols.sn); hdr('Gün', cols.gun); hdr('Tarih', cols.tarih);
    hdr('Saat', cols.saat); hdr('Sınav Dersi', cols.ders);
    if (hasSubeler) hdr('Şubeler', cols.subeler);
    hdr('Açıklama', cols.aciklama);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.6, color: rgb(0.5, 0.5, 0.55) });
    y -= 12;

    // Rows
    for (const row of opts.rows) {
      if (y < 140) break;
      const rowY = y;
      page.drawText(String(row.sn), { x: cols.sn, y: rowY, size: 8, font });
      page.drawText(row.gun, { x: cols.gun, y: rowY, size: 8, font });
      page.drawText(row.tarih, { x: cols.tarih, y: rowY, size: 8, font });
      page.drawText(row.saat, { x: cols.saat, y: rowY, size: 8, font });
      page.drawText(row.sinavDersi.slice(0, 30), { x: cols.ders, y: rowY, size: 8, font: fontBold });
      if (hasSubeler && row.subeler) {
        page.drawText(row.subeler.slice(0, 24), { x: cols.subeler, y: rowY, size: 8, font });
      }
      if (row.aciklama) {
        page.drawText(row.aciklama.slice(0, 20), { x: cols.aciklama, y: rowY, size: 8, font });
      }
      y -= 4;
      page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.2, color: rgb(0.85, 0.85, 0.88) });
      y -= 10;
    }

    // Footer notes
    if (opts.footerLines?.length) {
      y -= 8;
      page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.4, color: rgb(0.6, 0.6, 0.65) });
      y -= 12;
      page.drawText('Açıklama', { x: margin, y, size: 8, font: fontBold });
      y -= 12;
      for (const raw of opts.footerLines) {
        for (const part of chunkText(raw, 105)) {
          page.drawText(`- ${part}`, { x: margin, y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
          y -= 10;
        }
      }
    }

    // Signature block
    if (opts.duzenleyen || opts.onaylayan) {
      const sigY = Math.min(y - 30, 160);
      if (opts.duzenleyen) {
        const leftX = margin + 60;
        page.drawText('Düzenleyen', { x: leftX, y: sigY, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(opts.duzenleyen.name.toUpperCase(), { x: leftX, y: sigY - 14, size: 9, font: fontBold });
        page.drawText(opts.duzenleyen.title, { x: leftX, y: sigY - 26, size: 8, font: fontBold });
      }
      if (opts.onaylayan) {
        const rightX = pageW - margin - 120;
        page.drawText('Onaylayan', { x: rightX, y: sigY, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(opts.onaylayan.name.toUpperCase(), { x: rightX, y: sigY - 14, size: 9, font: fontBold });
        page.drawText(opts.onaylayan.title, { x: rightX, y: sigY - 26, size: 8, font: fontBold });
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
    examPdfBuffer?: Buffer;
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

    // Yüklenen sınav PDF
    let examSrcDoc: Awaited<ReturnType<typeof PDFDocument.load>> | null = null;
    if (opts.examPdfBuffer?.length) {
      try { examSrcDoc = await PDFDocument.load(opts.examPdfBuffer); } catch { examSrcDoc = null; }
    }

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

    // Kompakt header yüksekliği: 2 satır toplamda ~58pt
    const HEADER_H = 58;

    /**
     * drawHeader — sayfanın üstüne 58pt'lik kompakt öğrenci şeridi çizer.
     * Dönen değer: header'ın alt kenarı (y koordinatı, pdf-lib mantığıyla pageH'ten aşağı iner)
     */
    const drawHeader = async (page: ReturnType<typeof doc.addPage>, s: typeof allStudents[0]) => {
      const top = pageH - m; // header üstü

      // ── Satır 1: koyu şerit ──────────────────────────────────────────
      const row1H = 22;
      page.drawRectangle({ x: m, y: top - row1H, width: pageW - m * 2, height: row1H, color: rgb(0.12, 0.22, 0.48) });

      const roomStr  = `${s.buildingName ? s.buildingName + ' / ' : ''}${s.roomName}`;
      const seatStr  = `Sıra: ${s.seatLabel}`;
      const seatW    = fontBold.widthOfTextAtSize(seatStr, 10);
      const examInfo = `${opts.subjectLabel ?? opts.planTitle}  •  ${opts.examStartsAt.toLocaleDateString('tr-TR')} ${opts.examStartsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

      page.drawText(roomStr.slice(0, 40),  { x: m + 5, y: top - 15, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page.drawText(examInfo.slice(0, 48), { x: m + 175, y: top - 15, size: 7.5, font, color: rgb(0.8, 0.85, 1) });
      page.drawText(seatStr, { x: pageW - m - seatW - 5, y: top - 15, size: 10, font: fontBold, color: rgb(1, 1, 1) });

      // ── Satır 2: öğrenci bilgileri + QR ─────────────────────────────
      const row2Y = top - row1H;
      const row2H = HEADER_H - row1H;
      page.drawRectangle({ x: m, y: row2Y - row2H, width: pageW - m * 2, height: row2H, color: rgb(0.95, 0.96, 1), borderColor: rgb(0.78, 0.82, 0.9), borderWidth: 0.4 });

      // QR
      const qrSize = row2H - 4;
      const qrData = [s.studentNumber, s.studentName, s.classLabel, s.seatLabel, s.roomName].filter(Boolean).join('|');
      const qrBuf  = await getQr(qrData);
      if (qrBuf) {
        const qrImg = await doc.embedPng(qrBuf);
        page.drawImage(qrImg, { x: pageW - m - qrSize - 2, y: row2Y - row2H + 2, width: qrSize, height: qrSize });
      }

      // Bilgi kutuları (soldan sağa, QR'ın soluna kadar)
      const infoW = pageW - m * 2 - qrSize - 8;
      const boxes = [
        { label: 'Adı Soyadı', value: s.studentName,         w: Math.round(infoW * 0.52) },
        { label: 'Sınıf',      value: s.classLabel,           w: Math.round(infoW * 0.18) },
        { label: 'Öğrenci No', value: s.studentNumber ?? '—', w: Math.round(infoW * 0.28) },
      ];
      let bx = m + 3;
      for (const b of boxes) {
        page.drawText(b.label, { x: bx, y: row2Y - 8, size: 6, font, color: rgb(0.45, 0.45, 0.55) });
        page.drawText((b.value ?? '—').slice(0, 30), { x: bx, y: row2Y - 20, size: 9, font: fontBold, color: rgb(0.1, 0.15, 0.4) });
        bx += b.w;
      }

      return top - HEADER_H; // alt kenar y'si
    };

    // ── Her öğrenci ───────────────────────────────────────────────────
    for (const s of allStudents) {
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
        // Sınav PDF yüklenmemişse sadece header sayfası
        const page1 = doc.addPage([pageW, pageH]);
        await drawHeader(page1, s);
      }
    }

    return doc.save();
  }

}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.slice(0, 30)];
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
