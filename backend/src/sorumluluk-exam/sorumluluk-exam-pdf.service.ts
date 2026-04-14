import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import { SorumlulukGroup } from './entities/sorumluluk-group.entity';
import { SorumlulukSession } from './entities/sorumluluk-session.entity';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function fmtTime(t: string): string {
  return t ? t.substring(0, 5) : t;
}

function fmtDateWithDay(d: string): [string, string] {
  if (!d) return [d, ''];
  const p = d.split('-').map(Number);
  if (p.length !== 3) return [d, ''];
  const date = new Date(p[0], p[1] - 1, p[2]);
  return [
    `${String(p[2]).padStart(2, '0')}.${String(p[1]).padStart(2, '0')}.${p[0]}`,
    GUNLER[date.getDay()] ?? '',
  ];
}

/** Metni maksimum piksel genişliğine sığdır; sığmazsa '…' ekle */
function trunc(text: string, maxPx: number, f: PDFFont, size: number): string {
  if (!text) return '';
  if (f.widthOfTextAtSize(text, size) <= maxPx) return text;
  let s = text;
  while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxPx) s = s.slice(0, -1);
  return s + '…';
}

function getFontPaths() {
  try {
    return { sans: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'), bold: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf') };
  } catch {
    const base = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
    return { sans: join(base, 'DejaVuSans.ttf'), bold: join(base, 'DejaVuSans-Bold.ttf') };
  }
}

const C = {
  header:     rgb(0.08, 0.18, 0.42),
  headerText: rgb(1, 1, 1),
  colHeader:  rgb(0.18, 0.32, 0.62),
  rowOdd:     rgb(0.95, 0.97, 1.0),
  rowEven:    rgb(1, 1, 1),
  border:     rgb(0.75, 0.80, 0.90),
  text:       rgb(0.1, 0.1, 0.15),
  muted:      rgb(0.4, 0.4, 0.5),
  accent:     rgb(0.08, 0.18, 0.42),
  subText:    rgb(0.7, 0.8, 1),
  lightBlue:  rgb(0.9, 0.93, 1),
};

// ─── Landscape kolonları (W=842, m=30, usable=782) ───────────────────────────
// sira=22 | tarih=98 | saat=68 | ders=152 | ogr=30 | kom1=115 | kom2=115 | gozcu=95 | salon=87
const LCX = (m: number) => ({
  sira:    m,           // w=22
  tarih:   m + 22,      // w=98
  saat:    m + 120,     // w=68
  ders:    m + 188,     // w=152
  ogrenci: m + 340,     // w=30
  kom1:    m + 370,     // w=115
  kom2:    m + 485,     // w=115
  gozcu:   m + 600,     // w=95
  salon:   m + 695,     // w=87  → end = m+782 = 812 = W-m ✓
});
const LW = { sira: 22, tarih: 98, saat: 68, ders: 152, ogrenci: 30, kom1: 115, kom2: 115, gozcu: 95, salon: 87 };

@Injectable()
export class SorumlulukExamPdfService {
  private async _base() {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getFontPaths();
    const font     = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    return { doc, font, fontBold };
  }

  // ── Yoklama listesi (portrait A4) ──────────────────────────────────────────
  async buildYoklamaPdf(opts: {
    groupTitle: string;
    subjectName: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    roomName: string;
    schoolName?: string;
    rows: Array<{ sira: number; studentName: string; studentNumber: string | null; className: string | null; attendanceStatus: string | null }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    // Kolon pozisyonları (sıra|ad soyad|no|sınıf|durum|imza)
    const COL = { sira: m, ad: m + 22, no: m + 255, sinif: m + 322, durum: m + 384, imza: m + 445 };
    const COL_W = { sira: 22, ad: 233, no: 67, sinif: 62, durum: 61, imza: W - m - 445 };
    let page = doc.addPage([W, H]);
    let y = H - m;

    const addPage = () => { page = doc.addPage([W, H]); y = H - m; };

    const drawHeader = () => {
      page.drawRectangle({ x: m, y: y - 50, width: W - m * 2, height: 54, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      }
      page.drawText(trunc(opts.groupTitle, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: y - 28, size: 9, font: fontBold, color: C.lightBlue });
      const typeW = fontBold.widthOfTextAtSize('YOKLAMA LİSTESİ', 8);
      page.drawText('YOKLAMA LİSTESİ', { x: W - m - typeW - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      y -= 62;

      const [dateStr, dayStr] = fmtDateWithDay(opts.sessionDate);
      page.drawRectangle({ x: m, y: y - 20, width: W - m * 2, height: 22, color: rgb(0.93, 0.95, 1) });
      page.drawText(trunc(opts.subjectName, 200, fontBold, 9.5), { x: m + 8, y: y - 13, size: 9.5, font: fontBold, color: C.accent });
      const info = `${dateStr} ${dayStr}  |  ${fmtTime(opts.startTime)}–${fmtTime(opts.endTime)}  |  Salon: ${opts.roomName || '—'}`;
      const iw = font.widthOfTextAtSize(info, 7.5);
      page.drawText(info, { x: W - m - iw - 6, y: y - 13, size: 7.5, font, color: C.muted });
      y -= 30;

      page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
      const hy = y - 12;
      page.drawText('No',         { x: COL.sira + 3, y: hy, size: 7.5, font: fontBold, color: C.headerText });
      page.drawText('Adı Soyadı', { x: COL.ad + 3,   y: hy, size: 7.5, font: fontBold, color: C.headerText });
      page.drawText('Okul No',    { x: COL.no + 3,   y: hy, size: 7.5, font: fontBold, color: C.headerText });
      page.drawText('Sınıf',      { x: COL.sinif + 3,y: hy, size: 7.5, font: fontBold, color: C.headerText });
      page.drawText('Durum',      { x: COL.durum + 3,y: hy, size: 7.5, font: fontBold, color: C.headerText });
      page.drawText('İmza',       { x: COL.imza + 3, y: hy, size: 7.5, font: fontBold, color: C.headerText });
      y -= 22;
    };

    drawHeader();
    for (let i = 0; i < opts.rows.length; i++) {
      if (y < 80) { addPage(); drawHeader(); }
      const r = opts.rows[i];
      const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
      page.drawRectangle({ x: m, y: y - 4, width: W - m * 2, height: 15, color: bg });
      page.drawLine({ start: { x: m, y: y - 4 }, end: { x: W - m, y: y - 4 }, thickness: 0.25, color: C.border });
      // vertical dividers
      for (const x of [COL.ad, COL.no, COL.sinif, COL.durum, COL.imza]) {
        page.drawLine({ start: { x, y: y - 4 }, end: { x, y: y + 11 }, thickness: 0.2, color: C.border });
      }
      page.drawText(String(r.sira),                                         { x: COL.sira + 3, y, size: 7.5, font,      color: C.muted });
      page.drawText(trunc(r.studentName, COL_W.ad - 6, font, 7.5),          { x: COL.ad + 3,   y, size: 7.5, font,      color: C.text });
      page.drawText(trunc(r.studentNumber ?? '—', COL_W.no - 6, font, 7.5), { x: COL.no + 3,   y, size: 7.5, font,      color: C.text });
      page.drawText(trunc(r.className ?? '—', COL_W.sinif - 6, font, 7.5),  { x: COL.sinif + 3,y, size: 7.5, font,      color: C.text });
      const durum = r.attendanceStatus === 'present' ? 'Geldi' : r.attendanceStatus === 'absent' ? 'Gelmedi' : r.attendanceStatus === 'excused' ? 'Mazeretli' : '';
      if (durum) {
        const dc = r.attendanceStatus === 'present' ? rgb(0.1, 0.55, 0.2) : r.attendanceStatus === 'absent' ? rgb(0.75, 0.1, 0.1) : rgb(0.6, 0.45, 0.05);
        page.drawText(durum, { x: COL.durum + 3, y, size: 7.5, font: fontBold, color: dc });
      }
      // imza kutusu – sağ kenara kadar (W - m)
      page.drawRectangle({ x: COL.imza, y: y - 4, width: W - m - COL.imza, height: 15, borderColor: C.border, borderWidth: 0.4 });
      y -= 15;
    }

    y -= 10;
    const total   = opts.rows.length;
    const present = opts.rows.filter((r) => r.attendanceStatus === 'present').length;
    const absent  = opts.rows.filter((r) => r.attendanceStatus === 'absent').length;
    page.drawRectangle({ x: m, y: y - 16, width: W - m * 2, height: 18, color: rgb(0.93, 0.95, 1) });
    page.drawText(`Toplam: ${total}   |   Gelen: ${present}   |   Gelmeyen: ${absent}`, { x: m + 8, y: y - 10, size: 8.5, font: fontBold, color: C.accent });
    y -= 34;

    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
    y -= 18;
    const sigCols3 = (W - m * 2) / 3;
    for (const [idx, label] of (['Gözetmen', 'Komisyon Üyesi 1', 'Komisyon Üyesi 2'] as string[]).entries()) {
      const sx = m + idx * sigCols3 + 10;
      page.drawText(label, { x: sx, y, size: 7.5, font, color: C.muted });
      page.drawText('İmza / Kaşe:', { x: sx, y: y - 14, size: 7, font, color: C.muted });
      page.drawLine({ start: { x: sx, y: y - 26 }, end: { x: sx + sigCols3 - 20, y: y - 26 }, thickness: 0.4, color: C.border });
    }

    return doc.save();
  }

  // ── Sınav programı (landscape A4 — MEB format) ─────────────────────────────
  async buildProgramPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    sessions: Array<SorumlulukSession & { studentCount: number; proctors: Array<{ role: string; name: string }> }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 842; const H = 595; const m = 30;
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';
    const mainTitle = opts.group.title.toUpperCase();
    const subTitle  = `${opts.group.academicYear ? opts.group.academicYear + ' ' : ''}${examLabel} PROGRAMI`;
    const cx = LCX(m);

    const drawDividers = (top: number, bot: number) => {
      for (const x of [cx.tarih, cx.saat, cx.ders, cx.ogrenci, cx.kom1, cx.kom2, cx.gozcu, cx.salon]) {
        page.drawLine({ start: { x, y: top }, end: { x, y: bot }, thickness: 0.25, color: C.border });
      }
    };

    const drawPageHeader = () => {
      page.drawRectangle({ x: m, y: y - 52, width: W - m * 2, height: 56, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 80, fontBold, 8.5), { x: m + 10, y: y - 15, size: 8.5, font: fontBold, color: C.headerText });
      }
      page.drawText(trunc(mainTitle, W - m * 2 - 20, fontBold, 10), { x: m + 10, y: y - 29, size: 10, font: fontBold, color: C.lightBlue });
      page.drawText(trunc(subTitle, W - m * 2 - 20, font, 8),       { x: m + 10, y: y - 42, size: 8,  font,         color: C.subText });
      const pTxt = `Sayfa ${pageNum}`;
      const pw = font.widthOfTextAtSize(pTxt, 7);
      page.drawText(pTxt, { x: W - m - pw - 6, y: y - 15, size: 7, font, color: C.subText });
      y -= 64;

      page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
      const hy = y - 12;
      page.drawText('Sıra',             { x: cx.sira + 2,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Sınav Tarihi',     { x: cx.tarih + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Saati',            { x: cx.saat + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Ders Adı',         { x: cx.ders + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Öğr.',             { x: cx.ogrenci + 3, y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Komisyon Üyesi 1', { x: cx.kom1 + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Komisyon Üyesi 2', { x: cx.kom2 + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Gözetmen',         { x: cx.gozcu + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Sınav Salonu',     { x: cx.salon + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      y -= 22;
    };

    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    const ROW_H = 26;
    for (let i = 0; i < opts.sessions.length; i++) {
      if (y < 60) addPage();
      const s = opts.sessions[i];
      const [dateStr, dayStr] = fmtDateWithDay(s.sessionDate);
      const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
      const rowTop = y + 4; const rowBot = y - ROW_H + 4;
      page.drawRectangle({ x: m, y: rowBot, width: W - m * 2, height: ROW_H, color: bg });
      page.drawLine({ start: { x: m, y: rowBot }, end: { x: W - m, y: rowBot }, thickness: 0.25, color: C.border });
      drawDividers(rowTop, rowBot);

      const ty = y - 7; const ty2 = y - 18;
      page.drawText(String(i + 1),                                                   { x: cx.sira + 2,    y: ty,  size: 7.5, font: fontBold, color: C.muted });
      page.drawText(dateStr,                                                          { x: cx.tarih + 3,   y: ty,  size: 7.5, font,           color: C.text });
      page.drawText(dayStr,                                                           { x: cx.tarih + 3,   y: ty2, size: 6.5, font,           color: C.muted });
      page.drawText(`${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`,                 { x: cx.saat + 3,    y: ty,  size: 7.5, font,           color: C.text });
      page.drawText(trunc(s.subjectName, LW.ders - 6, fontBold, 7.5),               { x: cx.ders + 3,    y: ty,  size: 7.5, font: fontBold, color: C.accent });
      const typeLabel = s.sessionType === 'uygulama' ? 'UYGULAMA' : s.sessionType === 'mixed' ? 'YAZILI + UYGULAMA' : (opts.group.examType === 'beceri' ? 'UYGULAMALI' : 'YAZILI');
      page.drawText(typeLabel,                                                         { x: cx.ders + 3,    y: ty2, size: 6,   font,           color: C.muted });
      page.drawText(String(s.studentCount),                                           { x: cx.ogrenci + 3, y: ty,  size: 7.5, font: fontBold, color: C.text });

      const k = s.proctors.filter((p) => p.role === 'komisyon_uye');
      const g = s.proctors.filter((p) => p.role === 'gozcu');
      if (k[0]) page.drawText(trunc(k[0].name, LW.kom1 - 6,  font, 7.5), { x: cx.kom1 + 3,  y: ty, size: 7.5, font, color: C.text });
      if (k[1]) page.drawText(trunc(k[1].name, LW.kom2 - 6,  font, 7.5), { x: cx.kom2 + 3,  y: ty, size: 7.5, font, color: C.text });
      if (g[0]) page.drawText(trunc(g[0].name, LW.gozcu - 6, font, 7.5), { x: cx.gozcu + 3, y: ty, size: 7.5, font, color: C.text });
      if (s.roomName) page.drawText(trunc(s.roomName, LW.salon - 6, font, 7.5), { x: cx.salon + 3, y: ty, size: 7.5, font, color: C.text });

      y -= ROW_H;
    }

    y -= 10;
    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
    y -= 14;
    page.drawText(`Toplam ${opts.sessions.length} oturum`, { x: m, y, size: 7.5, font, color: C.muted });

    return doc.save();
  }

  // ── Öğrenci bazlı program (portrait A4) ────────────────────────────────────
  async buildOgrenciProgramPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    students: Array<{ studentName: string; studentNumber: string | null; className: string | null; subjects: Array<{ subjectName: string; session: SorumlulukSession | null }> }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    // Kolon: ders|tarih|saat|salon
    const SC = { ders: m, tarih: m + 175, saat: m + 288, salon: m + 358 };
    const SW = { ders: 175, tarih: 113, saat: 70, salon: W - m - 358 };
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    const drawPageHeader = () => {
      page.drawRectangle({ x: m, y: y - 50, width: W - m * 2, height: 54, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      }
      page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: y - 27, size: 9, font: fontBold, color: C.lightBlue });
      const rl  = `${examLabel} — ÖĞRENCİ PROGRAMI`;
      const rlw = fontBold.widthOfTextAtSize(rl, 8);
      page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      const pt = `Sayfa ${pageNum}`;
      const ptw = font.widthOfTextAtSize(pt, 7);
      page.drawText(pt, { x: W - m - ptw - 6, y: y - 38, size: 7, font, color: C.subText });
      y -= 62;
    };

    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    for (const st of opts.students) {
      const needed = 26 + st.subjects.length * 15 + 10;
      if (y - needed < 60 && y < H - 80) addPage();

      page.drawRectangle({ x: m, y: y - 20, width: W - m * 2, height: 22, color: C.colHeader });
      page.drawText(trunc(st.studentName, 280, fontBold, 9), { x: m + 8, y: y - 13, size: 9, font: fontBold, color: C.headerText });
      const meta = [st.studentNumber ? `No: ${st.studentNumber}` : '', st.className ?? ''].filter(Boolean).join('  |  ');
      if (meta) {
        const mw = font.widthOfTextAtSize(meta, 8);
        page.drawText(meta, { x: W - m - mw - 8, y: y - 13, size: 8, font, color: rgb(0.85, 0.9, 1) });
      }
      y -= 26;

      page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 14, color: rgb(0.88, 0.91, 0.97) });
      page.drawText('Ders',  { x: SC.ders + 4,  y: y - 9, size: 7, font: fontBold, color: C.accent });
      page.drawText('Tarih / Gün', { x: SC.tarih + 4, y: y - 9, size: 7, font: fontBold, color: C.accent });
      page.drawText('Saat',  { x: SC.saat + 4,  y: y - 9, size: 7, font: fontBold, color: C.accent });
      page.drawText('Salon', { x: SC.salon + 4, y: y - 9, size: 7, font: fontBold, color: C.accent });
      // dividers
      for (const x of [SC.tarih, SC.saat, SC.salon]) {
        page.drawLine({ start: { x, y: y }, end: { x, y: y - 14 }, thickness: 0.2, color: C.border });
      }
      y -= 16;

      for (let j = 0; j < st.subjects.length; j++) {
        if (y < 70) addPage();
        const subj = st.subjects[j];
        const ses  = subj.session;
        const ROW  = 15;
        const bg   = j % 2 === 0 ? C.rowEven : C.rowOdd;
        page.drawRectangle({ x: m, y: y - ROW + 2, width: W - m * 2, height: ROW, color: bg });
        page.drawLine({ start: { x: m, y: y - ROW + 2 }, end: { x: W - m, y: y - ROW + 2 }, thickness: 0.2, color: C.border });
        for (const x of [SC.tarih, SC.saat, SC.salon]) {
          page.drawLine({ start: { x, y: y + 2 }, end: { x, y: y - ROW + 2 }, thickness: 0.2, color: C.border });
        }
        page.drawText(`${j + 1}. ${trunc(subj.subjectName, SW.ders - 28, fontBold, 7.5)}`, { x: SC.ders + 4, y: y - 8, size: 7.5, font: fontBold, color: C.accent });
        if (ses) {
          const [dateStr, dayStr] = fmtDateWithDay(ses.sessionDate);
          const dateDay = `${dateStr} ${dayStr}`;
          page.drawText(trunc(dateDay, SW.tarih - 8, font, 7.5),                             { x: SC.tarih + 4, y: y - 8, size: 7.5, font, color: C.text });
          page.drawText(`${fmtTime(ses.startTime)}–${fmtTime(ses.endTime)}`,                  { x: SC.saat + 4,  y: y - 8, size: 7.5, font, color: C.text });
          page.drawText(trunc(ses.roomName ?? '—', SW.salon - 8, font, 7.5),                  { x: SC.salon + 4, y: y - 8, size: 7.5, font, color: C.text });
        } else {
          page.drawText('Oturum atanmamış', { x: SC.tarih + 4, y: y - 8, size: 7, font, color: rgb(0.7, 0.3, 0.1) });
        }
        y -= ROW;
      }
      y -= 8;
    }

    return doc.save();
  }

  // ── Öğretmen İmza Sirkülü (portrait A4) ───────────────────────────────────
  async buildImzaSirkuluPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    /** Her öğretmen için görev listesi */
    teachers: Array<{
      displayName: string;
      sessions: Array<{ subjectName: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null; role: string }>;
    }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    const drawPageHeader = () => {
      page.drawRectangle({ x: m, y: y - 50, width: W - m * 2, height: 54, color: C.header });
      if (opts.schoolName) page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: y - 28, size: 9, font: fontBold, color: C.lightBlue });
      const rl = `${examLabel} — ÖĞRETMEN İMZA SİRKÜLÜ`;
      const rlw = fontBold.widthOfTextAtSize(rl, 8);
      page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      const pt = `Sayfa ${pageNum}`;
      const ptw = font.widthOfTextAtSize(pt, 7);
      page.drawText(pt, { x: W - m - ptw - 6, y: y - 38, size: 7, font, color: C.subText });
      y -= 62;
    };
    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    // Sütunlar: ders | tarih+gün | saat | salon | görev | imza
    const SC = { ders: m, tarih: m + 140, saat: m + 258, salon: m + 320, gorev: m + 385, imza: m + 435 };

    for (const tch of opts.teachers) {
      const needed = 28 + tch.sessions.length * 16 + 30;
      if (y - needed < 60 && y < H - 80) addPage();

      // Öğretmen başlık
      page.drawRectangle({ x: m, y: y - 20, width: W - m * 2, height: 22, color: C.colHeader });
      page.drawText(trunc(tch.displayName, W - m * 2 - 16, fontBold, 9.5), { x: m + 8, y: y - 13, size: 9.5, font: fontBold, color: C.headerText });
      y -= 26;

      // Alt başlık
      page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 14, color: rgb(0.88, 0.91, 0.97) });
      for (const [label, x] of [['Ders', SC.ders], ['Tarih / Gün', SC.tarih], ['Saat', SC.saat], ['Salon', SC.salon], ['Görevi', SC.gorev], ['İmza', SC.imza]] as [string, number][]) {
        page.drawText(label, { x: x + 4, y: y - 9, size: 6.5, font: fontBold, color: C.accent });
      }
      for (const x of [SC.tarih, SC.saat, SC.salon, SC.gorev, SC.imza]) {
        page.drawLine({ start: { x, y }, end: { x, y: y - 14 }, thickness: 0.2, color: C.border });
      }
      y -= 16;

      for (let j = 0; j < tch.sessions.length; j++) {
        if (y < 70) addPage();
        const s = tch.sessions[j];
        const [dateStr, dayStr] = fmtDateWithDay(s.sessionDate);
        const bg = j % 2 === 0 ? C.rowEven : C.rowOdd;
        const ROW = 16;
        page.drawRectangle({ x: m, y: y - ROW + 2, width: W - m * 2, height: ROW, color: bg });
        page.drawLine({ start: { x: m, y: y - ROW + 2 }, end: { x: W - m, y: y - ROW + 2 }, thickness: 0.2, color: C.border });
        for (const x of [SC.tarih, SC.saat, SC.salon, SC.gorev, SC.imza]) {
          page.drawLine({ start: { x, y: y + 2 }, end: { x, y: y - ROW + 2 }, thickness: 0.2, color: C.border });
        }
        const roleLabel = s.role === 'komisyon_uye' ? 'Komisyon' : s.role === 'gozcu' ? 'Gözcü' : s.role;
        page.drawText(trunc(s.subjectName, SC.tarih - SC.ders - 8, fontBold, 7.5),       { x: SC.ders + 4,  y: y - 9, size: 7.5, font: fontBold, color: C.accent });
        page.drawText(trunc(`${dateStr} ${dayStr}`, SC.saat - SC.tarih - 8, font, 7),    { x: SC.tarih + 4, y: y - 9, size: 7, font, color: C.text });
        page.drawText(`${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`,                    { x: SC.saat + 4,  y: y - 9, size: 7, font, color: C.text });
        page.drawText(trunc(s.roomName ?? '—', SC.gorev - SC.salon - 8, font, 7),        { x: SC.salon + 4, y: y - 9, size: 7, font, color: C.text });
        page.drawText(roleLabel,                                                            { x: SC.gorev + 4, y: y - 9, size: 7, font, color: C.muted });
        y -= ROW;
      }
      // İmza çizgisi
      y -= 4;
      page.drawLine({ start: { x: m + 20, y }, end: { x: m + 150, y }, thickness: 0.5, color: C.border });
      page.drawText('İmza / Tarih:', { x: m + 20, y: y + 4, size: 6.5, font, color: C.muted });
      y -= 16;
    }

    return doc.save();
  }

  // ── Öğretmen Görev Dağılımı (portrait A4) ─────────────────────────────────
  async buildGorevDagilimPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    teachers: Array<{ displayName: string; komisyon: number; gozcu: number }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    let page = doc.addPage([W, H]);
    let y = H - m;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    page.drawRectangle({ x: m, y: y - 50, width: W - m * 2, height: 54, color: C.header });
    if (opts.schoolName) page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
    page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: y - 28, size: 9, font: fontBold, color: C.lightBlue });
    const rl = `${examLabel} — ÖĞRETMEN GÖREV DAĞILIMI`;
    const rlw = fontBold.widthOfTextAtSize(rl, 8);
    page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
    y -= 62;

    // Tablo
    const TC = { sira: m, ad: m + 24, kom: m + 330, gozcu: m + 390, toplam: m + 445, saat: m + 490 };
    page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
    const hy = y - 12;
    page.drawText('Sıra',          { x: TC.sira + 3,  y: hy, size: 7, font: fontBold, color: C.headerText });
    page.drawText('Öğretmen Adı',  { x: TC.ad + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
    page.drawText('Kom. Üyesi',    { x: TC.kom + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
    page.drawText('Gözcü',         { x: TC.gozcu + 3, y: hy, size: 7, font: fontBold, color: C.headerText });
    page.drawText('Toplam',        { x: TC.toplam + 3,y: hy, size: 7, font: fontBold, color: C.headerText });
    page.drawText('Ek Ders (saat)',{ x: TC.saat + 3,  y: hy, size: 7, font: fontBold, color: C.headerText });
    y -= 22;

    // Per MEB: komisyon 2 saat/sınav, gözcü 1 saat/sınav değil — 5 saat/oturum olarak hesapla
    const sorted = [...opts.teachers].sort((a, b) => (b.komisyon + b.gozcu) - (a.komisyon + a.gozcu));
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const toplam = t.komisyon + t.gozcu;
      const ekDers = toplam * 5;
      const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
      page.drawRectangle({ x: m, y: y - 4, width: W - m * 2, height: 16, color: bg });
      page.drawLine({ start: { x: m, y: y - 4 }, end: { x: W - m, y: y - 4 }, thickness: 0.2, color: C.border });
      for (const x of [TC.ad, TC.kom, TC.gozcu, TC.toplam, TC.saat]) {
        page.drawLine({ start: { x, y: y + 12 }, end: { x, y: y - 4 }, thickness: 0.2, color: C.border });
      }
      page.drawText(String(i + 1),                                         { x: TC.sira + 3,  y, size: 7.5, font,      color: C.muted });
      page.drawText(trunc(t.displayName, TC.kom - TC.ad - 8, font, 7.5),  { x: TC.ad + 3,    y, size: 7.5, font,      color: C.text });
      page.drawText(String(t.komisyon),                                     { x: TC.kom + 3,   y, size: 7.5, font,      color: C.text });
      page.drawText(String(t.gozcu),                                        { x: TC.gozcu + 3, y, size: 7.5, font,      color: C.text });
      page.drawText(String(toplam),                                          { x: TC.toplam + 3,y, size: 7.5, font: fontBold, color: C.accent });
      page.drawText(String(ekDers),                                          { x: TC.saat + 3,  y, size: 7.5, font: fontBold, color: rgb(0.1, 0.45, 0.1) });
      y -= 16;
    }

    // Toplam
    y -= 8;
    const totKom   = sorted.reduce((a, t) => a + t.komisyon, 0);
    const totGozcu = sorted.reduce((a, t) => a + t.gozcu, 0);
    const totSaat  = (totKom + totGozcu) * 5;
    page.drawRectangle({ x: m, y: y - 16, width: W - m * 2, height: 18, color: rgb(0.93, 0.95, 1) });
    page.drawText('TOPLAM', { x: TC.ad + 3, y: y - 10, size: 7.5, font: fontBold, color: C.accent });
    page.drawText(String(totKom),  { x: TC.kom + 3,   y: y - 10, size: 7.5, font: fontBold, color: C.accent });
    page.drawText(String(totGozcu),{ x: TC.gozcu + 3, y: y - 10, size: 7.5, font: fontBold, color: C.accent });
    page.drawText(String(totKom + totGozcu), { x: TC.toplam + 3, y: y - 10, size: 7.5, font: fontBold, color: C.accent });
    page.drawText(String(totSaat), { x: TC.saat + 3,  y: y - 10, size: 7.5, font: fontBold, color: rgb(0.1, 0.45, 0.1) });

    return doc.save();
  }

  // ── Ek Ücret Onay Belgesi (portrait A4) ───────────────────────────────────
  async buildEkUcretOnayPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    academicYear?: string;
    teachers: Array<{ displayName: string; komisyon: number; gozcu: number }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    const page = doc.addPage([W, H]);
    let y = H - m;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    // Resmi başlık
    const ctr = (text: string, sz: number, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(text, sz);
      page.drawText(text, { x: (W - w) / 2, y, size: sz, font: f, color: C.accent });
      y -= sz + 4;
    };
    ctr('T.C.', 9, true);
    if (opts.schoolName) ctr(opts.schoolName.toUpperCase(), 9, true);
    ctr(`${opts.academicYear ?? opts.group.academicYear ?? ''} EĞİTİM-ÖĞRETİM YILI`, 8);
    y -= 4;
    ctr(`${examLabel} EK DERS ÜCRETİ ONAY BELGESİ`, 11, true);
    y -= 6;
    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.8, color: C.accent });
    y -= 14;

    // Bilgi satırı
    page.drawText(`Grup: ${opts.group.title}`, { x: m, y, size: 8, font: fontBold, color: C.text });
    y -= 18;

    // Tablo
    const TC = { sira: m, ad: m + 24, komisyon: m + 296, gozcu: m + 356, toplam: m + 416, saat: m + 466, onay: m + 506 };
    page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
    const hy = y - 12;
    page.drawText('Sıra',          { x: TC.sira + 3,     y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Öğretmen Adı',  { x: TC.ad + 3,       y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Kom.',          { x: TC.komisyon + 3,  y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Gözcü',         { x: TC.gozcu + 3,    y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Top.',          { x: TC.toplam + 3,   y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Saat (5×)',     { x: TC.saat + 3,     y: hy, size: 6.5, font: fontBold, color: C.headerText });
    page.drawText('Onay',          { x: TC.onay + 3,     y: hy, size: 6.5, font: fontBold, color: C.headerText });
    y -= 22;

    const sorted = [...opts.teachers].sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const toplam = t.komisyon + t.gozcu;
      const ekDers = toplam * 5;
      const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
      page.drawRectangle({ x: m, y: y - 4, width: W - m * 2, height: 16, color: bg });
      page.drawLine({ start: { x: m, y: y - 4 }, end: { x: W - m, y: y - 4 }, thickness: 0.2, color: C.border });
      for (const x of [TC.ad, TC.komisyon, TC.gozcu, TC.toplam, TC.saat, TC.onay]) {
        page.drawLine({ start: { x, y: y + 12 }, end: { x, y: y - 4 }, thickness: 0.2, color: C.border });
      }
      page.drawText(String(i + 1),                                                    { x: TC.sira + 3,     y, size: 7, font,      color: C.muted });
      page.drawText(trunc(t.displayName, TC.komisyon - TC.ad - 8, font, 7),           { x: TC.ad + 3,       y, size: 7, font,      color: C.text });
      page.drawText(String(t.komisyon),                                                { x: TC.komisyon + 3,  y, size: 7, font,      color: C.text });
      page.drawText(String(t.gozcu),                                                   { x: TC.gozcu + 3,    y, size: 7, font,      color: C.text });
      page.drawText(String(toplam),                                                    { x: TC.toplam + 3,   y, size: 7, font: fontBold, color: C.accent });
      page.drawText(String(ekDers),                                                    { x: TC.saat + 3,     y, size: 7, font: fontBold, color: rgb(0.1, 0.45, 0.1) });
      y -= 16;
    }

    // Toplam satırı
    y -= 8;
    const totSaat = sorted.reduce((a, t) => a + (t.komisyon + t.gozcu) * 5, 0);
    page.drawRectangle({ x: m, y: y - 16, width: W - m * 2, height: 18, color: rgb(0.93, 0.95, 1) });
    page.drawText('TOPLAM', { x: TC.ad + 3, y: y - 10, size: 7.5, font: fontBold, color: C.accent });
    page.drawText(String(totSaat), { x: TC.saat + 3, y: y - 10, size: 7.5, font: fontBold, color: rgb(0.1, 0.45, 0.1) });
    y -= 36;

    // Yasal dayanak notu
    page.drawText('Yasal Dayanak: Ortaöğretim Kurumları Yönetmeliği Madde 58 — Her sınav oturumu için 5 saat ek ders ücreti ödenir.', { x: m, y, size: 6.5, font, color: C.muted });
    y -= 40;

    // İmza alanları
    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
    y -= 18;
    const sigCols = (W - m * 2) / 3;
    for (const [idx, label] of (['Düzenleyen', 'Müdür Yardımcısı', 'Okul Müdürü'] as string[]).entries()) {
      const sx = m + idx * sigCols + 10;
      page.drawText(label, { x: sx, y, size: 8, font, color: C.muted });
      page.drawLine({ start: { x: sx, y: y - 22 }, end: { x: sx + sigCols - 20, y: y - 22 }, thickness: 0.5, color: C.border });
    }

    return doc.save();
  }

  // ── Sınav Tutanağı (oturum bazında, portrait A4) ───────────────────────────
  async buildTutanakPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    sessions: Array<SorumlulukSession & {
      studentCount: number;
      proctors: Array<{ role: string; displayName: string }>;
    }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    for (const s of opts.sessions) {
      const page = doc.addPage([W, H]);
      let y = H - m;

      const [dateStr, dayStr] = fmtDateWithDay(s.sessionDate);
      const k = s.proctors.filter((p) => p.role === 'komisyon_uye');
      const g = s.proctors.filter((p) => p.role === 'gozcu');

      // Başlık
      const ctr = (text: string, sz: number, bold = false) => {
        const f = bold ? fontBold : font;
        const w = f.widthOfTextAtSize(text, sz);
        page.drawText(text, { x: (W - w) / 2, y, size: sz, font: f, color: C.accent });
        y -= sz + 5;
      };
      ctr('T.C.', 9, true);
      if (opts.schoolName) ctr(opts.schoolName.toUpperCase(), 9, true);
      ctr(`${examLabel} SINAV TUTANAĞI`, 12, true);
      y -= 4;
      page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.8, color: C.accent });
      y -= 16;

      // Sınav bilgileri tablosu
      const drawField = (label: string, value: string) => {
        page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 16, color: y % 32 < 16 ? rgb(0.97, 0.97, 1) : C.rowEven });
        page.drawText(label + ':', { x: m + 6, y: y - 9, size: 8, font: fontBold, color: C.accent });
        page.drawText(value,        { x: m + 145, y: y - 9, size: 8, font, color: C.text });
        page.drawLine({ start: { x: m, y: y - 14 }, end: { x: W - m, y: y - 14 }, thickness: 0.2, color: C.border });
        y -= 16;
      };

      drawField('Ders',           s.subjectName);
      drawField('Sınav Tarihi',   `${dateStr} (${dayStr})`);
      drawField('Sınav Saati',    `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`);
      drawField('Sınav Salonu',   s.roomName ?? '—');
      drawField('Öğrenci Sayısı', String(s.studentCount));
      drawField('Sınav Türü',     opts.group.examType === 'beceri' ? 'Uygulamalı' : 'Yazılı');
      y -= 10;

      // Görevliler
      page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
      page.drawText('GÖREVLİ ÖĞRETMENLER', { x: m + 8, y: y - 12, size: 8, font: fontBold, color: C.headerText });
      y -= 24;

      const drawTeacher = (role: string, name: string) => {
        page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 16, color: C.rowOdd });
        page.drawText(role, { x: m + 6, y: y - 9, size: 8, font: fontBold, color: C.accent });
        page.drawText(name, { x: m + 145, y: y - 9, size: 8, font, color: C.text });
        page.drawLine({ start: { x: m, y: y - 14 }, end: { x: W - m, y: y - 14 }, thickness: 0.2, color: C.border });
        y -= 16;
      };
      k.forEach((p) => drawTeacher('Komisyon Üyesi', p.displayName));
      g.forEach((p) => drawTeacher('Gözetmen', p.displayName));
      y -= 14;

      // Sınav süreci notları
      page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
      page.drawText('SINAV SÜREÇ NOTLARI', { x: m + 8, y: y - 12, size: 8, font: fontBold, color: C.headerText });
      y -= 24;
      for (const label of ['Sınava Giren Öğrenci Sayısı:', 'Sınava Girmeyen Öğrenci Sayısı:', 'Kopya / İhraç Durumu:']) {
        page.drawText(label, { x: m + 6, y, size: 8, font, color: C.text });
        page.drawLine({ start: { x: m + 200, y: y - 2 }, end: { x: W - m - 30, y: y - 2 }, thickness: 0.4, color: C.border });
        y -= 20;
      }
      y -= 8;
      // Geniş not alanı
      page.drawRectangle({ x: m, y: y - 55, width: W - m * 2, height: 58, borderColor: C.border, borderWidth: 0.5 });
      page.drawText('Açıklamalar / Notlar:', { x: m + 6, y: y - 10, size: 7.5, font, color: C.muted });
      y -= 80;

      // İmza alanları
      page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
      y -= 18;
      const sigCols = (W - m * 2) / 3;
      for (const [idx, label] of (['Komisyon Üyesi 1', 'Komisyon Üyesi 2', 'Gözetmen'] as string[]).entries()) {
        const sx = m + idx * sigCols + 6;
        page.drawText(label, { x: sx, y, size: 7.5, font, color: C.muted });
        page.drawText('Ad / İmza:', { x: sx, y: y - 14, size: 7, font, color: C.muted });
        page.drawLine({ start: { x: sx, y: y - 28 }, end: { x: sx + sigCols - 14, y: y - 28 }, thickness: 0.5, color: C.border });
      }
    }

    return doc.save();
  }

  // ── Görevlendirme çizelgesi (landscape A4 — MEB format) ────────────────────
  async buildGorevlendirmePdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    sessions: Array<SorumlulukSession & { proctors: Array<{ role: string; displayName: string }> }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 842; const H = 595; const m = 30;
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';
    const mainTitle = opts.group.title.toUpperCase();
    const subTitle  = `${opts.group.academicYear ? opts.group.academicYear + ' ' : ''}${examLabel} GÖREVLENDİRME ÇİZELGESİ`;
    const cx = LCX(m);

    const drawDividers = (top: number, bot: number) => {
      for (const x of [cx.tarih, cx.saat, cx.ders, cx.ogrenci, cx.kom1, cx.kom2, cx.gozcu, cx.salon]) {
        page.drawLine({ start: { x, y: top }, end: { x, y: bot }, thickness: 0.25, color: C.border });
      }
    };

    const drawPageHeader = () => {
      page.drawRectangle({ x: m, y: y - 52, width: W - m * 2, height: 56, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 80, fontBold, 8.5), { x: m + 10, y: y - 15, size: 8.5, font: fontBold, color: C.headerText });
      }
      page.drawText(trunc(mainTitle, W - m * 2 - 20, fontBold, 10), { x: m + 10, y: y - 29, size: 10, font: fontBold, color: C.lightBlue });
      page.drawText(trunc(subTitle, W - m * 2 - 20, font, 8),        { x: m + 10, y: y - 42, size: 8,  font,         color: C.subText });
      const pTxt = `Sayfa ${pageNum}`;
      const pw = font.widthOfTextAtSize(pTxt, 7);
      page.drawText(pTxt, { x: W - m - pw - 6, y: y - 15, size: 7, font, color: C.subText });
      y -= 64;

      page.drawRectangle({ x: m, y: y - 18, width: W - m * 2, height: 18, color: C.colHeader });
      const hy = y - 12;
      page.drawText('Sıra',             { x: cx.sira + 2,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Sınav Tarihi',     { x: cx.tarih + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Saati',            { x: cx.saat + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Ders Adı',         { x: cx.ders + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Öğr.',             { x: cx.ogrenci + 3, y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Komisyon Üyesi 1', { x: cx.kom1 + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Komisyon Üyesi 2', { x: cx.kom2 + 3,    y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Gözetmen',         { x: cx.gozcu + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      page.drawText('Sınav Salonu',     { x: cx.salon + 3,   y: hy, size: 7, font: fontBold, color: C.headerText });
      y -= 22;
    };

    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    const ROW_H = 26;
    for (let i = 0; i < opts.sessions.length; i++) {
      if (y < 80) addPage();
      const s = opts.sessions[i];
      const [dateStr, dayStr] = fmtDateWithDay(s.sessionDate);
      const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
      const rowTop = y + 4; const rowBot = y - ROW_H + 4;
      page.drawRectangle({ x: m, y: rowBot, width: W - m * 2, height: ROW_H, color: bg });
      page.drawLine({ start: { x: m, y: rowBot }, end: { x: W - m, y: rowBot }, thickness: 0.25, color: C.border });
      drawDividers(rowTop, rowBot);

      const ty = y - 7; const ty2 = y - 18;
      page.drawText(String(i + 1),                                                 { x: cx.sira + 2,    y: ty,  size: 7.5, font: fontBold, color: C.muted });
      page.drawText(dateStr,                                                        { x: cx.tarih + 3,   y: ty,  size: 7.5, font,           color: C.text });
      page.drawText(dayStr,                                                         { x: cx.tarih + 3,   y: ty2, size: 6.5, font,           color: C.muted });
      page.drawText(`${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`,               { x: cx.saat + 3,    y: ty,  size: 7.5, font,           color: C.text });
      page.drawText(trunc(s.subjectName, LW.ders - 6, fontBold, 7.5),             { x: cx.ders + 3,    y: ty,  size: 7.5, font: fontBold, color: C.accent });
      page.drawText(opts.group.examType === 'beceri' ? 'UYGULAMALI' : 'YAZILI',   { x: cx.ders + 3,    y: ty2, size: 6,   font,           color: C.muted });

      const k = s.proctors.filter((p) => p.role === 'komisyon_uye');
      const g = s.proctors.filter((p) => p.role === 'gozcu');
      if (k[0]) page.drawText(trunc(k[0].displayName, LW.kom1 - 6,  font, 7.5), { x: cx.kom1 + 3,  y: ty, size: 7.5, font, color: C.text });
      if (k[1]) page.drawText(trunc(k[1].displayName, LW.kom2 - 6,  font, 7.5), { x: cx.kom2 + 3,  y: ty, size: 7.5, font, color: C.text });
      if (g[0]) page.drawText(trunc(g[0].displayName, LW.gozcu - 6, font, 7.5), { x: cx.gozcu + 3, y: ty, size: 7.5, font, color: C.text });
      if (s.roomName) page.drawText(trunc(s.roomName, LW.salon - 6, font, 7.5), { x: cx.salon + 3, y: ty, size: 7.5, font, color: C.text });

      y -= ROW_H;
    }

    y -= 14;
    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
    y -= 18;
    const cols3 = (W - m * 2) / 3;
    for (const [idx, label] of (['Düzenleyen', 'Okul Müdür Yardımcısı', 'Okul Müdürü'] as string[]).entries()) {
      const sx = m + idx * cols3 + 10;
      page.drawText(label, { x: sx, y, size: 8, font, color: C.muted });
      page.drawLine({ start: { x: sx, y: y - 20 }, end: { x: sx + cols3 - 20, y: y - 20 }, thickness: 0.4, color: C.border });
    }

    return doc.save();
  }
}
