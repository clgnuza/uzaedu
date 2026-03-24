/**
 * Örnek Coğrafya yıllık plan şablonları oluşturur: DOCX, XLSX, PDF
 * Örnek plan yapısına göre (AY, HAFTA, DERS SAATİ, KONU, ÖĞRENME ÇIKTILARI, SÜREÇ BİLEŞENLERİ...)
 * Kullanım: cd backend && npx ts-node -r tsconfig-paths/register scripts/create-yillik-plan-templates.ts
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
} from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// MEB TYMM taslak yapısı – iki seviyeli başlık
const HEADER_ROW1: { text: string; columnSpan: number }[] = [
  { text: 'SÜRE', columnSpan: 3 },
  { text: 'ÜNİTE/TEMA- İÇERİK ÇERÇEVESİ', columnSpan: 2 },
  { text: 'ÖĞRENME ÇIKTILARI VE SÜREÇ BİLEŞENLERİ', columnSpan: 2 },
  { text: 'ÖĞRENME KANITLARI', columnSpan: 1 },
  { text: 'PROGRAMLAR ARASI BİLEŞENLER', columnSpan: 3 },
  { text: 'BELİRLİ GÜN VE HAFTALAR', columnSpan: 1 },
  { text: 'FARKLILAŞTIRMA', columnSpan: 1 },
  { text: 'OKUL TEMELLİ PLANLAMA', columnSpan: 1 },
];
// ornek-yillik-plan-modern ile aynı sütun başlıkları
const COLUMN_HEADERS = [
  'AY',
  'HAFTA',
  'DERS SAATİ',
  'ÜNİTE / TEMA',
  'KONU\n(İÇERİK ÇERÇEVESİ)',
  'ÖĞRENME\nÇIKTILARI',
  'SÜREÇ\nBİLEŞENLERİ',
  'ÖLÇME VE\nDEĞERLENDİRME',
  'SOSYAL - DUYGUSAL\nÖĞRENME BECERİLERİ',
  'DEĞERLER',
  'OKURYAZARLIK\nBECERİLERİ',
  'BELİRLİ\nGÜN VE\nHAFTALAR',
  'FARKLILAŞTIRMA',
  'OKUL TEMELLİ\nPLANLAMA',
];

// ornek-yillik-plan-modern ile aynı sütun genişlikleri (twips)
const COL_WIDTHS = [
  750, 700, 450, 480, 2150, 2150, 1400, 1150,
  900, 650, 950, 1050, 800, 1150,
];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const LIGHT_GREEN = 'D4EDDA';
const LIGHT_GREY = 'E8ECF0';

// --- DOCX --- (ornek-yillik-plan-modern ile aynı yapı)
async function createDocxTemplate() {
  const cellMargins = { top: 80, bottom: 80, left: 80, right: 80 };
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  };

  const headerRow1 = new TableRow({
    tableHeader: true,
    height: { value: 400, rule: 'atLeast' as any },
    children: HEADER_ROW1.map(
      (item) =>
        new TableCell({
          columnSpan: item.columnSpan,
          children: [
            new Paragraph({
              children: [new TextRun({ text: item.text, bold: true, size: 16, font: 'Calibri' })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: LIGHT_GREEN },
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
        }),
    ),
  });
  const headerRow2 = new TableRow({
    tableHeader: true,
    height: { value: 550, rule: 'atLeast' as any },
    children: COLUMN_HEADERS.map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 16, font: 'Calibri' })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { fill: LIGHT_GREY },
          verticalAlign: VerticalAlign.CENTER,
          margins: cellMargins,
        }),
    ),
  });

  // Örnek 2-3 satır veri (placeholder'lı) – 14 sütun
  const sampleRows = [
    ['EYLÜL', '{hafta_1}', '2', '{unite_1}', '{konu_1}', '{kazanim_1}', '{surec_1}', '{olcme_1}', '', '', '', '{belirli_gun_1}', '', ''],
    ['EYLÜL', '{hafta_2}', '2', '{unite_2}', '{konu_2}', '{kazanim_2}', '{surec_2}', '{olcme_2}', '', '', '', '', '', ''],
    ['EKİM', '{hafta_4}', '2', '{unite_4}', '{konu_4}', '{kazanim_4}', '{surec_4}', '{olcme_4}', '', '', '', '', '', ''],
  ];

  const dataRows = sampleRows.map(
    (cells) =>
      new TableRow({
        height: { value: 600, rule: 'atLeast' as any },
        children: cells.map(
          (c) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(c), size: 18, font: 'Calibri' })],
                }),
              ],
              verticalAlign: VerticalAlign.TOP,
              margins: cellMargins,
            }),
        ),
      })
  );

  const table = new Table({
    rows: [headerRow1, headerRow2, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: COL_WIDTHS,
    borders: tableBorders,
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: '{ogretim_yili} – {okul_adi_upper} – {sinif}. Sınıf {ders_adi} Yıllık Plan', bold: true, size: 24 })],
            alignment: 'center' as const,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Zümre Öğretmenleri: {zumre_satiri}', size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Müdür: {mudur_adi}  |  Onay Tarihi: {onay_tarihi}', size: 18 })],
            spacing: { after: 400 },
          }),
          table,
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const outPath = path.join(TEMPLATES_DIR, 'ornek-yillik-plan-cografya.docx');
  ensureDir(TEMPLATES_DIR);
  fs.writeFileSync(outPath, buf);
  console.log('Oluşturuldu:', outPath);
}

// --- XLSX --- (ornek-yillik-plan-modern ile aynı sütun yapısı)
function createXlsxTemplate() {
  const headers = COLUMN_HEADERS.map((h) => h.replace(/\n/g, ' '));
  const sampleData = [
    ['EYLÜL', '1. Hafta: 8-12 Eylül', 2, 'COĞRAFYANIN DOĞASI', 'Coğrafya Biliminin Konusu', 'COĞ.9.1.1. ...', 'DB1.1, SDB1.2', 'Öğretmen gözlemi', '', '', '', '15 Temmuz Demokrasi Günü', '', ''],
    ['EYLÜL', '2. Hafta: 15-19 Eylül', 2, 'COĞRAFYANIN DOĞASI', 'Niçin Coğrafya Öğrenmeliyiz?', 'COĞ.9.1.2. ...', 'DB1.1, SDB2.1', 'Sözlü sunum', '', '', '', '', '', ''],
    ['EKİM', '4. Hafta: 29 Eylül - 3 Ekim', 2, 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', 'Mekânın Aynası Haritalar', 'COĞ.9.2.1. ...', 'DB2.1, SDB2.2', 'Harita okuma', '', '', '', '', '', ''],
  ];

  const data: (string | number)[][] = [
    [''],
    ['{ogretim_yili} – {okul_adi_upper} – {sinif}. Sınıf {ders_adi} Yıllık Plan'],
    ['Zümre: {zumre_satiri}  |  Müdür: {mudur_adi}  |  Onay: {onay_tarihi}'],
    [],
    headers,
    ...sampleData,
    [],
    ['1. DÖNEM ARA TATİLİ: 10-14 Kasım'],
    [],
    ['YARIYIL TATİLİ: 19-30 Ocak'],
    [],
    ['2. DÖNEM ARA TATİLİ: 16-20 Mart'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = COL_WIDTHS.map((w) => ({ wch: Math.max(5, Math.round(w / 80)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '9. Sınıf Coğrafya');

  const outPath = path.join(TEMPLATES_DIR, 'ornek-yillik-plan-cografya.xlsx');
  ensureDir(TEMPLATES_DIR);
  XLSX.writeFile(wb, outPath);
  console.log('Oluşturuldu:', outPath);
}

// --- PDF --- (ornek-yillik-plan-modern ile aynı sütun oranları, 14 sütun)
async function createPdfTemplate() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 550;
  const fontSize = 8;
  const rowHeight = 12;
  const margin = 50;
  const usableWidth = 842 - margin * 2;
  const totalTwips = COL_WIDTHS.reduce((a, b) => a + b, 0);
  const colWidthsPx = COL_WIDTHS.map((w) => (usableWidth * w) / totalTwips);

  const toAscii = (s: string) =>
    s.replace(/[ıİğĞüÜşŞöÖçÇ]/g, (c) => ({ ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ş: 's', Ş: 'S', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' }[c] ?? c));

  const headerLabels = COLUMN_HEADERS.map((h) => toAscii(h.replace(/\n/g, ' ')));

  page.drawText('2025-2026 - ORNEK OKUL - 9. Sinif Cografya Yillik Plan', {
    x: margin,
    y,
    font: fontBold,
    size: 14,
  });
  y -= 25;

  // Tablo başlıkları – 14 sütun, açık gri (LIGHT_GREY #E8ECF0 ≈ rgb 0.91,0.93,0.94)
  const greyFill = rgb(0.91, 0.93, 0.94);
  let x = margin;
  headerLabels.forEach((h, i) => {
    const w = colWidthsPx[i] ?? 50;
    page.drawRectangle({ x, y, width: w, height: rowHeight, color: greyFill });
    const text = h.length > 10 ? h.slice(0, 9) + '.' : h;
    page.drawText(text, { x: x + 2, y: y + 3, font: fontBold, size: 6 });
    x += w;
  });
  y -= rowHeight;

  const sampleRows = [
    ['EYLUL', '1.Hafta', '2', 'Unite', 'Konu', 'COG.9.1.1', 'DB1.1', 'Gozlem', '', '', '', '15 Tem.', '', ''],
    ['EYLUL', '2.Hafta', '2', 'Unite', 'Konu', 'COG.9.1.2', 'DB1.1', 'Sunum', '', '', '', '', '', ''],
    ['EKIM', '4.Hafta', '2', 'Unite', 'Harita', 'COG.9.2.1', 'DB2.1', 'Harita', '', '', '', '', '', ''],
  ];

  sampleRows.forEach((row) => {
    x = margin;
    row.forEach((cell, i) => {
      const w = colWidthsPx[i] ?? 50;
      let text = toAscii(String(cell));
      text = text.length > 12 ? text.slice(0, 11) + '.' : text;
      page.drawText(text, { x: x + 2, y: y + 3, font, size: fontSize - 1 });
      x += w;
    });
    y -= rowHeight;
  });

  // Helvetica WinAnsi - Turkce karakter desteklemez, ASCII kullan
  page.drawText('(PDF sablon - merge desteklenmez, test amacli)', {
    x: margin,
    y: 80,
    font,
    size: 8,
    color: rgb(0.5, 0.5, 0.5),
  });

  const outPath = path.join(TEMPLATES_DIR, 'ornek-yillik-plan-cografya.pdf');
  ensureDir(TEMPLATES_DIR);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, pdfBytes);
  console.log('Oluşturuldu:', outPath);
}

async function main() {
  console.log('Yıllık plan şablonları oluşturuluyor...\n');
  ensureDir(TEMPLATES_DIR);
  await createDocxTemplate();
  createXlsxTemplate();
  await createPdfTemplate();
  console.log('\nTamamlandı. Şablonlar:', TEMPLATES_DIR);
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
