import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import { SorumlulukGroup } from './entities/sorumluluk-group.entity';
import { SorumlulukSession } from './entities/sorumluluk-session.entity';
import type { SorumlulukPdfBelge } from './sorumluluk-pdf-belge.util';
import {
  sessionTutanakMode,
  TUTANAK_EVRAK_KEYS,
  type TutanakEvrakKey,
  type TutanakPdfOptions,
} from './sorumluluk-tutanak-options';

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

type SigBlock = { title: string; name?: string };

/** pdf-lib: barBottom = şeridin alt y koordinatı */
function textYInBar(barBottom: number, barHeight: number, fontSize: number, lift = 2.5): number {
  return barBottom + (barHeight - fontSize) / 2 + lift;
}

type TableCol = { id: string; label: string; width: number };

/** width: 0 = kalan genişliği ad sütununa ver */
function layoutTableCols(
  margin: number,
  tableWidth: number,
  specs: Array<{ id: string; label: string; width: number }>,
): { cols: TableCol[]; x: Record<string, number> } {
  const cols: TableCol[] = specs.map((s) => ({ id: s.id, label: s.label, width: s.width }));
  const flex = cols.find((c) => c.width <= 0);
  const fixed = cols.filter((c) => c.width > 0).reduce((a, c) => a + c.width, 0);
  if (flex) flex.width = Math.max(48, tableWidth - fixed);
  const x: Record<string, number> = {};
  let cur = margin;
  for (const c of cols) {
    x[c.id] = cur;
    cur += c.width;
  }
  return { cols, x };
}

/** Mavi kolon başlığı — yazı hücre içine sığdırılır (küçültme / kısaltma) */
function drawColHeaderRow(
  page: PDFPage,
  fontBold: PDFFont,
  margin: number,
  tableWidth: number,
  yTop: number,
  cols: TableCol[],
  baseSize = 7,
): number {
  const rowH = 20;
  const padX = 3;
  const bottom = yTop - rowH;
  page.drawRectangle({ x: margin, y: bottom, width: tableWidth, height: rowH, color: C.colHeader });
  let cx = margin;
  for (const col of cols) {
    const maxW = Math.max(10, col.width - padX * 2);
    let size = baseSize;
    let label = col.label;
    while (size > 5.25 && fontBold.widthOfTextAtSize(label, size) > maxW) size -= 0.25;
    if (fontBold.widthOfTextAtSize(label, size) > maxW) label = trunc(label, maxW, fontBold, size);
    page.drawText(label, {
      x: cx + padX,
      y: textYInBar(bottom, rowH, size),
      size,
      font: fontBold,
      color: C.headerText,
    });
    cx += col.width;
  }
  return bottom - 4;
}

function drawLandscapeGorevHeaders(
  page: PDFPage,
  cx: ReturnType<typeof LCX>,
  barBottom: number,
  barH: number,
  fontBold: PDFFont,
) {
  const padX = 3;
  const items: Array<{ key: keyof ReturnType<typeof LCX>; w: number; label: string }> = [
    { key: 'sira', w: LW.sira, label: 'Sıra' },
    { key: 'tarih', w: LW.tarih, label: 'Tarih' },
    { key: 'saat', w: LW.saat, label: 'Saat' },
    { key: 'ders', w: LW.ders, label: 'Ders adı' },
    { key: 'ogrenci', w: LW.ogrenci, label: 'Öğr.' },
    { key: 'kom1', w: LW.kom1, label: 'Kom. 1' },
    { key: 'kom2', w: LW.kom2, label: 'Kom. 2' },
    { key: 'gozcu', w: LW.gozcu, label: 'Gözetmen' },
    { key: 'salon', w: LW.salon, label: 'Salon' },
  ];
  for (const { key, w, label } of items) {
    const maxW = Math.max(10, w - padX * 2);
    let size = 6.5;
    let text = label;
    while (size > 5.25 && fontBold.widthOfTextAtSize(text, size) > maxW) size -= 0.25;
    if (fontBold.widthOfTextAtSize(text, size) > maxW) text = trunc(text, maxW, fontBold, size);
    page.drawText(text, {
      x: cx[key] + padX,
      y: textYInBar(barBottom, barH, size),
      size,
      font: fontBold,
      color: C.headerText,
    });
  }
}

function mergedDuzenleyenAdi(belge?: SorumlulukPdfBelge): string | undefined {
  const d = (belge?.duzenleyenAdi ?? '').trim();
  const my = (belge?.mudurYardimcisiAdi ?? '').trim();
  if (d) return d;
  if (my) return my;
  return undefined;
}

function officialSigBlocks(belge?: SorumlulukPdfBelge): SigBlock[] {
  return [
    { title: 'Düzenleyen / Okul Müdür Yardımcısı', name: mergedDuzenleyenAdi(belge) },
    { title: 'Okul Müdürü', name: belge?.mudurAdi || undefined },
  ];
}

/** Üstten alta: unvan, isteğe bağlı ad, «İmza / Tarih», çizgi */
function drawSigFooter(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  W: number,
  m: number,
  y: number,
  blocks: SigBlock[],
): void {
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.4, color: C.border });
  let cy = y - 16;
  const cols = blocks.length;
  const sigW = (W - m * 2) / cols;
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    const sx = m + idx * sigW + 8;
    let ty = cy;
    page.drawText(b.title, { x: sx, y: ty, size: 8, font, color: C.muted });
    ty -= 12;
    if (b.name?.trim()) {
      page.drawText(trunc(b.name.trim(), sigW - 20, fontBold, 8), { x: sx, y: ty, size: 8, font: fontBold, color: C.text });
      ty -= 12;
    }
    page.drawText('İmza / Tarih:', { x: sx, y: ty, size: 7, font, color: C.muted });
    page.drawLine({ start: { x: sx, y: ty - 14 }, end: { x: sx + sigW - 16, y: ty - 14 }, thickness: 0.5, color: C.border });
  }
}

/** MEB okul evrak seti: yazılı / uygulamalı oturum ayrımı */
type TutanakProctor = { role: string; displayName: string };
type TutanakSessionIn = SorumlulukSession & { studentCount: number; proctors: TutanakProctor[] };

type TutanakDrawKit = {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  W: number;
  H: number;
  m: number;
  schoolName?: string;
  belge?: SorumlulukPdfBelge;
  examLabel: string;
  groupTitle: string;
  s: TutanakSessionIn;
  dateStr: string;
  dayStr: string;
  k: TutanakProctor[];
  g: TutanakProctor[];
  mode: 'yazili' | 'uygulama';
};

function tutanakSinavTurLabel(mode: 'yazili' | 'uygulama', sessionType: string): string {
  if (mode === 'uygulama') return 'Uygulamalı';
  if (sessionType === 'mixed') return 'Yazılı';
  return 'Yazılı';
}

function tutanakKomisyonSigs(k: TutanakProctor[], g: TutanakProctor[]): SigBlock[] {
  return [
    { title: 'Komisyon Üyesi 1', name: k[0]?.displayName },
    { title: 'Komisyon Üyesi 2', name: k[1]?.displayName },
    { title: 'Gözetmen', name: g[0]?.displayName },
  ];
}

function tutanakNewPage(kit: TutanakDrawKit): { page: PDFPage; y: number } {
  const page = kit.doc.addPage([kit.W, kit.H]);
  return { page, y: kit.H - kit.m };
}

function tutanakOfficialHeader(
  page: PDFPage,
  kit: TutanakDrawKit,
  y: number,
  docTitle: string,
): number {
  const { W, m, font, fontBold, schoolName, belge } = kit;
  const ctr = (text: string, sz: number, bold = false) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(text, sz);
    page.drawText(text, { x: (W - w) / 2, y, size: sz, font: f, color: C.accent });
    return y - sz - 5;
  };
  y = ctr('T.C.', 9, true);
  if (schoolName) y = ctr(schoolName.toUpperCase(), 9, true);
  if (belge?.academicYear) y = ctr(belge.academicYear, 8);
  y = ctr(docTitle, 11, true);
  y -= 4;
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.8, color: C.accent });
  return y - 14;
}

function tutanakDrawFields(
  page: PDFPage,
  kit: TutanakDrawKit,
  y: number,
  fields: Array<[string, string]>,
): number {
  const { W, m, font, fontBold } = kit;
  for (const [label, value] of fields) {
    page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 16, color: C.rowEven });
    page.drawText(`${label}:`, { x: m + 6, y: y - 9, size: 8, font: fontBold, color: C.accent });
    page.drawText(trunc(value, W - m * 2 - 155, font, 8), { x: m + 145, y: y - 9, size: 8, font, color: C.text });
    page.drawLine({ start: { x: m, y: y - 14 }, end: { x: W - m, y: y - 14 }, thickness: 0.2, color: C.border });
    y -= 16;
  }
  return y;
}

function tutanakDrawWrap(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxW: number,
  font: PDFFont,
  size: number,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let cy = y;
  const lh = size + 4;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      page.drawText(line, { x, y: cy, size, font, color: C.text });
      cy -= lh;
      line = w;
    } else line = test;
  }
  if (line) {
    page.drawText(line, { x, y: cy, size, font, color: C.text });
    cy -= lh;
  }
  return cy;
}

function tutanakDrawCheckItems(page: PDFPage, kit: TutanakDrawKit, y: number, items: string[]): number {
  const { W, m, font } = kit;
  for (const item of items) {
    page.drawRectangle({ x: m + 4, y: y - 10, width: 10, height: 10, borderColor: C.border, borderWidth: 0.5 });
    page.drawText(item, { x: m + 20, y: y - 9, size: 7.5, font, color: C.text });
    y -= 16;
  }
  return y - 6;
}

function tutanakSessionFields(kit: TutanakDrawKit): Array<[string, string]> {
  const { s, dateStr, dayStr, mode, groupTitle } = kit;
  return [
    ['Grup', groupTitle],
    ['Ders', s.subjectName],
    ['Sınav Tarihi', `${dateStr} (${dayStr})`],
    ['Sınav Saati', `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`],
    ['Salon', s.roomName ?? '—'],
    ['Öğrenci Sayısı', String(s.studentCount)],
    ['Sınav Türü', tutanakSinavTurLabel(mode, s.sessionType)],
  ];
}

function tutanakDrawGorevliler(page: PDFPage, kit: TutanakDrawKit, y: number): number {
  const { W, m, font, fontBold, k, g } = kit;
  const secHdrH = 18;
  const secHdrBottom = y - secHdrH;
  page.drawRectangle({ x: m, y: secHdrBottom, width: W - m * 2, height: secHdrH, color: C.colHeader });
  page.drawText('GÖREVLİ ÖĞRETMENLER', { x: m + 8, y: textYInBar(secHdrBottom, secHdrH, 8), size: 8, font: fontBold, color: C.headerText });
  y -= 24;
  const row = (role: string, name: string) => {
    page.drawRectangle({ x: m, y: y - 14, width: W - m * 2, height: 16, color: C.rowOdd });
    page.drawText(role, { x: m + 6, y: y - 9, size: 8, font: fontBold, color: C.accent });
    page.drawText(trunc(name || '—', W - m * 2 - 155, font, 8), { x: m + 145, y: y - 9, size: 8, font, color: C.text });
    page.drawLine({ start: { x: m, y: y - 14 }, end: { x: W - m, y: y - 14 }, thickness: 0.2, color: C.border });
    y -= 16;
  };
  k.forEach((p, i) => row(`Komisyon Üyesi ${i + 1}`, p.displayName));
  if (k.length < 2) row('Komisyon Üyesi 2', '');
  g.forEach((p) => row('Gözetmen', p.displayName));
  if (!g.length) row('Gözetmen', '');
  return y - 8;
}

function tutanakPageZarfEvrak(kit: TutanakDrawKit): void {
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — SINAV EVRAK ZARF KAPAĞI`);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y -= 8;
  page.drawText('Zarf içeriği (işaretleyiniz):', { x: kit.m + 6, y, size: 8, font: kit.fontBold, color: C.accent });
  y -= 14;
  const items =
    kit.mode === 'yazili'
      ? [
          'Sınav programı / görevlendirme çizelgesi',
          'Sınav esasları tespit ve başlangıç tutanağı',
          'Yazılı sınav soru tutanağı ve soru kitapçığı/zarfı',
          'Yazılı sınav cevap anahtarı tutanağı ve cevap zarfı',
          'Öğrenci cevap kağıtları',
          'Sınav tutanağı',
          'Sınava girmeyenlere dair tutanak',
        ]
      : [
          'Sınav programı / görevlendirme çizelgesi',
          'Uygulamalı sınav başlangıç tutanağı',
          'Uygulama değerlendirme formları / rubrik',
          'Uygulamalı sınav tutanağı',
          'Sınava girmeyenlere dair tutanak',
        ];
  y = tutanakDrawCheckItems(page, kit, y, items);
  y -= 10;
  page.drawText('Mühür / İmza:', { x: kit.m + 6, y, size: 7.5, font: kit.font, color: C.muted });
  page.drawLine({ start: { x: kit.m + 80, y: y - 2 }, end: { x: kit.W - kit.m - 40, y: y - 2 }, thickness: 0.5, color: C.border });
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 36, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageZarfSoruCevap(kit: TutanakDrawKit): void {
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — SORU-CEVAP KAĞIDI ZARF KAPAĞI`);
  y = tutanakDrawFields(page, kit, y, [
    ['Ders', kit.s.subjectName],
    ['Tarih', `${kit.dateStr} (${kit.dayStr})`],
    ['Saat', `${fmtTime(kit.s.startTime)} – ${fmtTime(kit.s.endTime)}`],
    ['Salon', kit.s.roomName ?? '—'],
  ]);
  y -= 10;
  y = tutanakDrawWrap(
    page,
    'Bu zarf; mühürlü soru kitapçığı / soru kağıtları ile ayrı mühürlü cevap anahtarı zarflarının güvenli şekilde saklanması amacıyla kullanılır.',
    kit.m + 6,
    y,
    kit.W - kit.m * 2 - 12,
    kit.font,
    8,
  );
  y -= 16;
  y = tutanakDrawCheckItems(page, kit, y, [
    'Soru kitapçığı / soru kağıdı zarfı mühürlü',
    'Cevap anahtarı zarfı mühürlü ve ayrı',
    'Komisyon üyeleri imzalı',
  ]);
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 40, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageEsaslarBaslangic(kit: TutanakDrawKit): void {
  const title =
    kit.mode === 'yazili'
      ? 'SINAV ESASLARI TESPİT VE SINAV BAŞLANGIÇ TUTANAĞI'
      : 'UYGULAMALI SINAV BAŞLANGIÇ TUTANAĞI';
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — ${title}`);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y = tutanakDrawGorevliler(page, kit, y);
  const intro =
    kit.mode === 'yazili'
      ? 'Aşağıdaki hususlar komisyon ve gözetmen öğretmenler huzurunda tespit edilmiş; sınav kuralları öğrencilere duyurulmuş ve sınav başlangıç saati kayda geçirilmiştir.'
      : 'Uygulamalı sınavın yeri, saati, görevlileri ve uygulama esasları tespit edilmiş; öğrencilere duyurulmuş ve sınav başlangıç saati kayda geçirilmiştir.';
  y = tutanakDrawWrap(page, intro, kit.m + 6, y, kit.W - kit.m * 2 - 12, kit.font, 8);
  y -= 6;
  const checks =
    kit.mode === 'yazili'
      ? [
          'Sınav salonu ve oturma düzeni uygun',
          'Sınav süresi ve başlangıç saati tespit edildi',
          'Görevli öğretmenler görev yerinde',
          'Kopya önleme tedbirleri alındı',
          'Öğrenci kimlik kontrolü yapıldı',
        ]
      : [
          'Uygulama alanı / atölye / laboratuvar hazır',
          'Değerlendirme kriterleri komisyona tebliğ edildi',
          'Görevli öğretmenler görev yerinde',
          'Öğrenci kimlik kontrolü yapıldı',
        ];
  y = tutanakDrawCheckItems(page, kit, y, checks);
  page.drawText('Sınav başlangıç saati:', { x: kit.m + 6, y, size: 8, font: kit.font, color: C.text });
  page.drawLine({ start: { x: kit.m + 130, y: y - 2 }, end: { x: kit.m + 220, y: y - 2 }, thickness: 0.4, color: C.border });
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 50, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageSoru(kit: TutanakDrawKit): void {
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — YAZILI SINAV SORU TUTANAĞI`);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y = tutanakDrawGorevliler(page, kit, y);
  y = tutanakDrawWrap(
    page,
    `${kit.s.subjectName} dersinden sorumluluk yazılı sınavına ait soru kitapçığı / soru kağıtları, aşağıda imzası bulunan komisyon tarafından hazırlanmış, kontrol edilmiş, mühürlenmiş ve zarfa konulmuştur.`,
    kit.m + 6,
    y,
    kit.W - kit.m * 2 - 12,
    kit.font,
    8,
  );
  y -= 8;
  for (const label of ['Soru sayısı / kitapçık adedi:', 'Soru kitapçığı / zarf no:', 'Mühür tarih ve saati:']) {
    page.drawText(label, { x: kit.m + 6, y, size: 8, font: kit.font, color: C.text });
    page.drawLine({ start: { x: kit.m + 175, y: y - 2 }, end: { x: kit.W - kit.m - 30, y: y - 2 }, thickness: 0.4, color: C.border });
    y -= 20;
  }
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 30, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageCevapAnahtari(kit: TutanakDrawKit): void {
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — YAZILI SINAV CEVAP ANAHTARI TUTANAĞI`);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y = tutanakDrawWrap(
    page,
    'Soru kitapçığına ait cevap anahtarı komisyon tarafından hazırlanmış, ayrı mühürlü zarfa konulmuş ve aşağıdaki öğretmenlerce imzalanmıştır.',
    kit.m + 6,
    y,
    kit.W - kit.m * 2 - 12,
    kit.font,
    8,
  );
  y -= 8;
  for (const label of ['Cevap anahtarı zarf no:', 'Soru kitapçığı ile eşleşme onayı:']) {
    page.drawText(label, { x: kit.m + 6, y, size: 8, font: kit.font, color: C.text });
    page.drawLine({ start: { x: kit.m + 175, y: y - 2 }, end: { x: kit.W - kit.m - 30, y: y - 2 }, thickness: 0.4, color: C.border });
    y -= 20;
  }
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 36, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageSinav(kit: TutanakDrawKit): void {
  const docTitle =
    kit.mode === 'yazili' ? `${kit.examLabel} SINAV TUTANAĞI` : `${kit.examLabel} UYGULAMALI SINAV TUTANAĞI`;
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, docTitle);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y = tutanakDrawGorevliler(page, kit, y);
  const secHdrH = 18;
  const secHdrBottom = y - secHdrH;
  page.drawRectangle({ x: kit.m, y: secHdrBottom, width: kit.W - kit.m * 2, height: secHdrH, color: C.colHeader });
  page.drawText('SINAV SÜREÇ NOTLARI', {
    x: kit.m + 8,
    y: textYInBar(secHdrBottom, secHdrH, 8),
    size: 8,
    font: kit.fontBold,
    color: C.headerText,
  });
  y -= 24;
  for (const label of ['Sınava Giren Öğrenci Sayısı:', 'Sınava Girmeyen Öğrenci Sayısı:', 'Kopya / İhraç Durumu:']) {
    page.drawText(label, { x: kit.m + 6, y, size: 8, font: kit.font, color: C.text });
    page.drawLine({ start: { x: kit.m + 200, y: y - 2 }, end: { x: kit.W - kit.m - 30, y: y - 2 }, thickness: 0.4, color: C.border });
    y -= 20;
  }
  y -= 8;
  page.drawRectangle({ x: kit.m, y: y - 55, width: kit.W - kit.m * 2, height: 58, borderColor: C.border, borderWidth: 0.5 });
  page.drawText('Açıklamalar / Notlar:', { x: kit.m + 6, y: y - 10, size: 7.5, font: kit.font, color: C.muted });
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 88, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPageGirmeyenler(kit: TutanakDrawKit): void {
  const { page, y: y0 } = tutanakNewPage(kit);
  let y = tutanakOfficialHeader(page, kit, y0, `${kit.examLabel} — SINAVA GİRMEDİKLERİNE DAİR TUTANAK`);
  y = tutanakDrawFields(page, kit, y, tutanakSessionFields(kit));
  y -= 6;
  const tw = kit.W - kit.m * 2;
  const { cols, x: TC } = layoutTableCols(kit.m, tw, [
    { id: 'sira', label: 'Sıra', width: 22 },
    { id: 'ad', label: 'Adı soyadı', width: 0 },
    { id: 'no', label: 'Okul no', width: 58 },
    { id: 'sinif', label: 'Sınıf', width: 52 },
    { id: 'neden', label: 'Açıklama', width: 72 },
  ]);
  y = drawColHeaderRow(page, kit.fontBold, kit.m, tw, y, cols, 7) - 6;
  const adW = cols.find((c) => c.id === 'ad')!.width;
  const rowH = 15;
  for (let i = 0; i < 14; i++) {
    const bg = i % 2 === 0 ? C.rowEven : C.rowOdd;
    page.drawRectangle({ x: kit.m, y: y - rowH + 2, width: tw, height: rowH, color: bg });
    page.drawLine({ start: { x: kit.m, y: y - rowH + 2 }, end: { x: kit.W - kit.m, y: y - rowH + 2 }, thickness: 0.2, color: C.border });
    for (const x of [TC.ad, TC.no, TC.sinif, TC.neden]) {
      page.drawLine({ start: { x, y: y + 2 }, end: { x, y: y - rowH + 2 }, thickness: 0.2, color: C.border });
    }
    page.drawText(String(i + 1), { x: TC.sira + 3, y: y - 9, size: 7.5, font: kit.font, color: C.muted });
    page.drawLine({ start: { x: TC.ad + 3, y: y - 4 }, end: { x: TC.ad + adW - 8, y: y - 4 }, thickness: 0.3, color: C.border });
    y -= rowH;
  }
  y -= 8;
  y = tutanakDrawWrap(
    page,
    'Yukarıda kimlik bilgileri yazılı öğrenciler sorumluluk sınavına katılmamıştır. Durum komisyon tarafından tespit edilmiştir.',
    kit.m + 6,
    y,
    tw - 12,
    kit.font,
    7.5,
  );
  drawSigFooter(page, kit.font, kit.fontBold, kit.W, kit.m, y - 44, tutanakKomisyonSigs(kit.k, kit.g));
}

function tutanakPagesForSession(kit: TutanakDrawKit, evrak: Set<TutanakEvrakKey>): void {
  if (evrak.has('zarf_evrak')) tutanakPageZarfEvrak(kit);
  if (evrak.has('zarf_soru_cevap') && kit.mode === 'yazili') tutanakPageZarfSoruCevap(kit);
  if (evrak.has('esaslar')) tutanakPageEsaslarBaslangic(kit);
  if (kit.mode === 'yazili') {
    if (evrak.has('soru')) tutanakPageSoru(kit);
    if (evrak.has('cevap')) tutanakPageCevapAnahtari(kit);
  }
  if (evrak.has('sinav')) tutanakPageSinav(kit);
  if (evrak.has('girmeyenler')) tutanakPageGirmeyenler(kit);
}

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
    belge?: SorumlulukPdfBelge;
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
      const hdrH = opts.belge?.academicYear ? 62 : 54;
      page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      }
      if (opts.belge?.academicYear) {
        page.drawText(trunc(opts.belge.academicYear, W - m * 2 - 16, font, 7.5), { x: m + 8, y: y - 26, size: 7.5, font, color: C.subText });
      }
      const titleY = opts.belge?.academicYear ? y - 40 : y - 28;
      page.drawText(trunc(opts.groupTitle, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: titleY, size: 9, font: fontBold, color: C.lightBlue });
      const typeW = fontBold.widthOfTextAtSize('YOKLAMA LİSTESİ', 8);
      page.drawText('YOKLAMA LİSTESİ', { x: W - m - typeW - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      y -= hdrH + 8;

      const [dateStr, dayStr] = fmtDateWithDay(opts.sessionDate);
      page.drawRectangle({ x: m, y: y - 20, width: W - m * 2, height: 22, color: rgb(0.93, 0.95, 1) });
      page.drawText(trunc(opts.subjectName, 200, fontBold, 9.5), { x: m + 8, y: y - 13, size: 9.5, font: fontBold, color: C.accent });
      const info = `${dateStr} ${dayStr}  |  ${fmtTime(opts.startTime)}–${fmtTime(opts.endTime)}  |  Salon: ${opts.roomName || '—'}`;
      const iw = font.widthOfTextAtSize(info, 7.5);
      page.drawText(info, { x: W - m - iw - 6, y: y - 13, size: 7.5, font, color: C.muted });
      y -= 30;

      const tw = W - m * 2;
      const { cols: ykCols } = layoutTableCols(m, tw, [
        { id: 'sira', label: 'No', width: COL_W.sira },
        { id: 'ad', label: 'Adı soyadı', width: COL_W.ad },
        { id: 'no', label: 'Okul no', width: COL_W.no },
        { id: 'sinif', label: 'Sınıf', width: COL_W.sinif },
        { id: 'durum', label: 'Durum', width: COL_W.durum },
        { id: 'imza', label: 'İmza', width: COL_W.imza },
      ]);
      y = drawColHeaderRow(page, fontBold, m, tw, y, ykCols, 7) - 14;
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

    drawSigFooter(page, font, fontBold, W, m, y, [
      { title: 'Gözetmen' },
      { title: 'Komisyon Üyesi 1' },
      { title: 'Komisyon Üyesi 2' },
    ]);

    return doc.save();
  }

  // ── Sınav programı (landscape A4 — MEB format) ─────────────────────────────
  async buildProgramPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
    sessions: Array<SorumlulukSession & { studentCount: number; proctors: Array<{ role: string; name: string }> }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 842; const H = 595; const m = 30;
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';
    const mainTitle = opts.group.title.toUpperCase();
    const subTitle  = `${examLabel} PROGRAMI`;
    const yearLine = opts.belge?.academicYear ?? '';
    const cx = LCX(m);

    const drawDividers = (top: number, bot: number) => {
      for (const x of [cx.tarih, cx.saat, cx.ders, cx.ogrenci, cx.kom1, cx.kom2, cx.gozcu, cx.salon]) {
        page.drawLine({ start: { x, y: top }, end: { x, y: bot }, thickness: 0.25, color: C.border });
      }
    };

    const drawPageHeader = () => {
      const hdrH = yearLine ? 68 : 56;
      page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 80, fontBold, 8.5), { x: m + 10, y: y - 15, size: 8.5, font: fontBold, color: C.headerText });
      }
      if (yearLine) {
        page.drawText(trunc(yearLine, W - m * 2 - 20, font, 8), { x: m + 10, y: y - 27, size: 8, font, color: C.subText });
      }
      const t1 = yearLine ? y - 40 : y - 29;
      const t2 = yearLine ? y - 53 : y - 42;
      page.drawText(trunc(mainTitle, W - m * 2 - 20, fontBold, 10), { x: m + 10, y: t1, size: 10, font: fontBold, color: C.lightBlue });
      page.drawText(trunc(subTitle, W - m * 2 - 20, font, 8), { x: m + 10, y: t2, size: 8, font, color: C.subText });
      const pTxt = `Sayfa ${pageNum}`;
      const pw = font.widthOfTextAtSize(pTxt, 7);
      page.drawText(pTxt, { x: W - m - pw - 6, y: y - 15, size: 7, font, color: C.subText });
      y -= hdrH + 8;

      const colHdrH = 20;
      const colHdrBottom = y - colHdrH;
      page.drawRectangle({ x: m, y: colHdrBottom, width: W - m * 2, height: colHdrH, color: C.colHeader });
      drawLandscapeGorevHeaders(page, cx, colHdrBottom, colHdrH, fontBold);
      y -= 24;
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
    page.drawText(`Toplam ${opts.sessions.length} oturum`, { x: m, y, size: 7.5, font, color: C.muted });
    if (y > 90) {
      drawSigFooter(page, font, fontBold, W, m, y - 16, officialSigBlocks(opts.belge));
    }

    return doc.save();
  }

  // ── Öğrenci bazlı program (portrait A4) ────────────────────────────────────
  async buildOgrenciProgramPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
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

    const yearLine = opts.belge?.academicYear ?? '';

    const drawPageHeader = () => {
      const hdrH = yearLine ? 62 : 54;
      page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      }
      if (yearLine) {
        page.drawText(trunc(yearLine, W - m * 2 - 16, font, 7.5), { x: m + 8, y: y - 26, size: 7.5, font, color: C.subText });
      }
      const titleY = yearLine ? y - 40 : y - 27;
      page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: titleY, size: 9, font: fontBold, color: C.lightBlue });
      const rl  = `${examLabel} — ÖĞRENCİ PROGRAMI`;
      const rlw = fontBold.widthOfTextAtSize(rl, 8);
      page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      const pt = `Sayfa ${pageNum}`;
      const ptw = font.widthOfTextAtSize(pt, 7);
      page.drawText(pt, { x: W - m - ptw - 6, y: y - 38, size: 7, font, color: C.subText });
      y -= hdrH + 8;
    };

    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    for (const st of opts.students) {
      const needed = 26 + st.subjects.length * 15 + 10;
      if (y - needed < 60 && y < H - 80) addPage();

      const stHdrH = 22;
      const stHdrBottom = y - stHdrH;
      page.drawRectangle({ x: m, y: stHdrBottom, width: W - m * 2, height: stHdrH, color: C.colHeader });
      const stHy = textYInBar(stHdrBottom, stHdrH, 9);
      page.drawText(trunc(st.studentName, 280, fontBold, 9), { x: m + 8, y: stHy, size: 9, font: fontBold, color: C.headerText });
      const meta = [st.studentNumber ? `No: ${st.studentNumber}` : '', st.className ?? ''].filter(Boolean).join('  |  ');
      if (meta) {
        const mw = font.widthOfTextAtSize(meta, 8);
        page.drawText(meta, { x: W - m - mw - 8, y: stHy, size: 8, font, color: rgb(0.85, 0.9, 1) });
      }
      y -= 26;

      const subHdrH = 14;
      const subHdrBottom = y - subHdrH;
      page.drawRectangle({ x: m, y: subHdrBottom, width: W - m * 2, height: subHdrH, color: rgb(0.88, 0.91, 0.97) });
      const subHy = textYInBar(subHdrBottom, subHdrH, 7);
      page.drawText('Ders',  { x: SC.ders + 4,  y: subHy, size: 7, font: fontBold, color: C.accent });
      page.drawText('Tarih / Gün', { x: SC.tarih + 4, y: subHy, size: 7, font: fontBold, color: C.accent });
      page.drawText('Saat',  { x: SC.saat + 4,  y: subHy, size: 7, font: fontBold, color: C.accent });
      page.drawText('Salon', { x: SC.salon + 4, y: subHy, size: 7, font: fontBold, color: C.accent });
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
    belge?: SorumlulukPdfBelge;
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

    const yearLine = opts.belge?.academicYear ?? '';

    const drawPageHeader = () => {
      const hdrH = yearLine ? 62 : 54;
      page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
      if (opts.schoolName) page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
      if (yearLine) page.drawText(trunc(yearLine, W - m * 2 - 16, font, 7.5), { x: m + 8, y: y - 26, size: 7.5, font, color: C.subText });
      const titleY = yearLine ? y - 40 : y - 28;
      page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: titleY, size: 9, font: fontBold, color: C.lightBlue });
      const rl = `${examLabel} — ÖĞRETMEN İMZA SİRKÜLÜ`;
      const rlw = fontBold.widthOfTextAtSize(rl, 8);
      page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
      const pt = `Sayfa ${pageNum}`;
      const ptw = font.widthOfTextAtSize(pt, 7);
      page.drawText(pt, { x: W - m - ptw - 6, y: y - 38, size: 7, font, color: C.subText });
      y -= hdrH + 8;
    };
    const addPage = () => { pageNum++; page = doc.addPage([W, H]); y = H - m; drawPageHeader(); };
    drawPageHeader();

    // Sütunlar: ders | tarih+gün | saat | salon | görev | imza
    const SC = { ders: m, tarih: m + 140, saat: m + 258, salon: m + 320, gorev: m + 385, imza: m + 435 };

    for (const tch of opts.teachers) {
      const needed = 28 + tch.sessions.length * 16 + 30;
      if (y - needed < 60 && y < H - 80) addPage();

      // Öğretmen başlık
      const tchHdrH = 22;
      const tchHdrBottom = y - tchHdrH;
      page.drawRectangle({ x: m, y: tchHdrBottom, width: W - m * 2, height: tchHdrH, color: C.colHeader });
      page.drawText(trunc(tch.displayName, W - m * 2 - 16, fontBold, 9.5), {
        x: m + 8, y: textYInBar(tchHdrBottom, tchHdrH, 9.5), size: 9.5, font: fontBold, color: C.headerText,
      });
      y -= 26;

      const subHdrH = 14;
      const subHdrBottom = y - subHdrH;
      page.drawRectangle({ x: m, y: subHdrBottom, width: W - m * 2, height: subHdrH, color: rgb(0.88, 0.91, 0.97) });
      const subHy = textYInBar(subHdrBottom, subHdrH, 6.5);
      for (const [label, x] of [['Ders', SC.ders], ['Tarih / Gün', SC.tarih], ['Saat', SC.saat], ['Salon', SC.salon], ['Görevi', SC.gorev], ['İmza', SC.imza]] as [string, number][]) {
        page.drawText(label, { x: x + 4, y: subHy, size: 6.5, font: fontBold, color: C.accent });
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
      y -= 6;
      const sigLabelY = y;
      page.drawText('İmza / Tarih:', { x: m + 20, y: sigLabelY, size: 6.5, font, color: C.muted });
      page.drawLine({ start: { x: m + 20, y: sigLabelY - 16 }, end: { x: W - m - 20, y: sigLabelY - 16 }, thickness: 0.5, color: C.border });
      y = sigLabelY - 28;
    }

    return doc.save();
  }

  // ── Öğretmen Görev Dağılımı (portrait A4) ─────────────────────────────────
  async buildGorevDagilimPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
    teachers: Array<{ displayName: string; komisyon: number; gozcu: number }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595; const H = 842; const m = 36;
    let page = doc.addPage([W, H]);
    let y = H - m;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';

    const yearLine = opts.belge?.academicYear ?? '';
    const hdrH = yearLine ? 62 : 54;
    page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
    if (opts.schoolName) page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 16, fontBold, 8), { x: m + 8, y: y - 14, size: 8, font: fontBold, color: C.headerText });
    if (yearLine) page.drawText(trunc(yearLine, W - m * 2 - 16, font, 7.5), { x: m + 8, y: y - 26, size: 7.5, font, color: C.subText });
    const titleY = yearLine ? y - 40 : y - 28;
    page.drawText(trunc(opts.group.title, W - m * 2 - 16, fontBold, 9), { x: m + 8, y: titleY, size: 9, font: fontBold, color: C.lightBlue });
    const rl = `${examLabel} — ÖĞRETMEN GÖREV DAĞILIMI`;
    const rlw = fontBold.widthOfTextAtSize(rl, 8);
    page.drawText(rl, { x: W - m - rlw - 6, y: y - 14, size: 8, font: fontBold, color: C.lightBlue });
    y -= hdrH + 8;

    const tw = W - m * 2;
    const { cols: dagCols, x: TC } = layoutTableCols(m, tw, [
      { id: 'sira', label: 'Sıra', width: 22 },
      { id: 'ad', label: 'Öğretmen adı', width: 0 },
      { id: 'kom', label: 'Kom.', width: 44 },
      { id: 'gozcu', label: 'Gözcü', width: 40 },
      { id: 'toplam', label: 'Toplam', width: 44 },
      { id: 'saat', label: 'Saat (5×)', width: 50 },
    ]);
    y = drawColHeaderRow(page, fontBold, m, tw, y, dagCols, 6.5) - 14;
    const adW = dagCols.find((c) => c.id === 'ad')!.width;

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
      page.drawText(trunc(t.displayName, adW - 8, font, 7.5),  { x: TC.ad + 3,    y, size: 7.5, font,      color: C.text });
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
    y -= 28;
    if (y > 100) drawSigFooter(page, font, fontBold, W, m, y, officialSigBlocks(opts.belge));

    return doc.save();
  }

  // ── Ek Ücret Onay Belgesi (portrait A4) ───────────────────────────────────
  async buildEkUcretOnayPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
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
    const yearLine = opts.belge?.academicYear ?? '';
    if (yearLine) ctr(yearLine, 8);
    y -= 4;
    ctr(`${examLabel} EK DERS ÜCRETİ ONAY BELGESİ`, 11, true);
    y -= 6;
    page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.8, color: C.accent });
    y -= 14;

    // Bilgi satırı
    page.drawText(`Grup: ${opts.group.title}`, { x: m, y, size: 8, font: fontBold, color: C.text });
    y -= 18;

    const tw = W - m * 2;
    const { cols: onayCols, x: TC } = layoutTableCols(m, tw, [
      { id: 'sira', label: 'Sıra', width: 22 },
      { id: 'ad', label: 'Öğretmen adı', width: 0 },
      { id: 'komisyon', label: 'Kom.', width: 40 },
      { id: 'gozcu', label: 'Gözcü', width: 40 },
      { id: 'toplam', label: 'Top.', width: 42 },
      { id: 'saat', label: 'Saat (5×)', width: 48 },
      { id: 'onay', label: 'Onay', width: 44 },
    ]);
    y = drawColHeaderRow(page, fontBold, m, tw, y, onayCols, 6.5) - 14;
    const adWOnay = onayCols.find((c) => c.id === 'ad')!.width;

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
      page.drawText(trunc(t.displayName, adWOnay - 8, font, 7),           { x: TC.ad + 3,       y, size: 7, font,      color: C.text });
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

    drawSigFooter(page, font, fontBold, W, m, y, officialSigBlocks(opts.belge));

    return doc.save();
  }

  // ── Sınav tutanakları — MEB evrak seti, oturum başına (tek PDF) ─────────────
  async buildTutanakPdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
    sessions: Array<TutanakSessionIn>;
    pdfOptions?: TutanakPdfOptions;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 595;
    const H = 842;
    const m = 36;
    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';
    const evrak = opts.pdfOptions?.evrak ?? new Set<TutanakEvrakKey>(TUTANAK_EVRAK_KEYS);

    for (const s of opts.sessions) {
      const [dateStr, dayStr] = fmtDateWithDay(s.sessionDate);
      const kit: TutanakDrawKit = {
        doc,
        font,
        fontBold,
        W,
        H,
        m,
        schoolName: opts.schoolName,
        belge: opts.belge,
        examLabel,
        groupTitle: opts.group.title,
        s,
        dateStr,
        dayStr,
        k: s.proctors.filter((p) => p.role === 'komisyon_uye'),
        g: s.proctors.filter((p) => p.role === 'gozcu'),
        mode: sessionTutanakMode(s, opts.group),
      };
      tutanakPagesForSession(kit, evrak);
    }

    return doc.save();
  }

  // ── Görevlendirme çizelgesi (landscape A4 — MEB format) ────────────────────
  async buildGorevlendirmePdf(opts: {
    group: SorumlulukGroup;
    schoolName?: string;
    belge?: SorumlulukPdfBelge;
    sessions: Array<SorumlulukSession & { proctors: Array<{ role: string; displayName: string }> }>;
  }): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this._base();
    const W = 842; const H = 595; const m = 30;
    let page = doc.addPage([W, H]);
    let y = H - m;
    let pageNum = 1;

    const examLabel = opts.group.examType === 'beceri' ? 'BECERİ SINAVI' : 'SORUMLULUK SINAVI';
    const mainTitle = opts.group.title.toUpperCase();
    const subTitle  = `${examLabel} GÖREVLENDİRME ÇİZELGESİ`;
    const yearLine = opts.belge?.academicYear ?? '';
    const cx = LCX(m);

    const drawDividers = (top: number, bot: number) => {
      for (const x of [cx.tarih, cx.saat, cx.ders, cx.ogrenci, cx.kom1, cx.kom2, cx.gozcu, cx.salon]) {
        page.drawLine({ start: { x, y: top }, end: { x, y: bot }, thickness: 0.25, color: C.border });
      }
    };

    const drawPageHeader = () => {
      const hdrH = yearLine ? 68 : 56;
      page.drawRectangle({ x: m, y: y - hdrH, width: W - m * 2, height: hdrH + 4, color: C.header });
      if (opts.schoolName) {
        page.drawText(trunc(opts.schoolName.toUpperCase(), W - m * 2 - 80, fontBold, 8.5), { x: m + 10, y: y - 15, size: 8.5, font: fontBold, color: C.headerText });
      }
      if (yearLine) {
        page.drawText(trunc(yearLine, W - m * 2 - 20, font, 8), { x: m + 10, y: y - 27, size: 8, font, color: C.subText });
      }
      const t1 = yearLine ? y - 40 : y - 29;
      const t2 = yearLine ? y - 53 : y - 42;
      page.drawText(trunc(mainTitle, W - m * 2 - 20, fontBold, 10), { x: m + 10, y: t1, size: 10, font: fontBold, color: C.lightBlue });
      page.drawText(trunc(subTitle, W - m * 2 - 20, font, 8), { x: m + 10, y: t2, size: 8, font, color: C.subText });
      const pTxt = `Sayfa ${pageNum}`;
      const pw = font.widthOfTextAtSize(pTxt, 7);
      page.drawText(pTxt, { x: W - m - pw - 6, y: y - 15, size: 7, font, color: C.subText });
      y -= hdrH + 8;

      const colHdrH = 20;
      const colHdrBottom = y - colHdrH;
      page.drawRectangle({ x: m, y: colHdrBottom, width: W - m * 2, height: colHdrH, color: C.colHeader });
      drawLandscapeGorevHeaders(page, cx, colHdrBottom, colHdrH, fontBold);
      y -= 24;
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
    if (y > 90) {
      drawSigFooter(page, font, fontBold, W, m, y, officialSigBlocks(opts.belge));
    }

    return doc.save();
  }
}
