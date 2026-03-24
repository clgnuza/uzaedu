/**
 * Orijinal örneğe birebir uyumlu, profesyonel yıllık plan DOCX şablonu.
 * 
 * Özellikler:
 * - Gereksiz nokta satırları yok
 * - Sütunlar içeriğe göre otomatik hizalı
 * - Yazılar kesilmeden tam görünür
 * - Zümre bilgisi üstte, onay kutusu altta düzenli
 * - Okunabilir font boyutları ve renkler
 *
 * Placeholder'lar:
 * - Başlık: {okul_adi}, {ogretim_yili}, {sinif}, {ders_adi}
 * - Meta: {zumre_ogretmenleri}, {mudur_adi}, {onay_tarihi}
 * - Tablo: {#haftalar}...{/haftalar} döngüsü
 * - Onay: {onay_tarihi_alt}, {ders_adi_ogretmeni} (3 kez)
 *
 * Kullanım: cd backend && npm run create-modern-yillik-plan
 */
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
  PageOrientation,
  convertInchesToTwip,
  AlignmentType,
  VerticalAlign,
  HeadingLevel,
} from 'docx';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const OUT_FILE = 'ornek-yillik-plan-modern.docx';

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

// Sütun genişlikleri (twips)
const COL_WIDTHS = [
  750,   // AY
  700,   // HAFTA
  450,   // DERS SAATİ
  480,   // ÜNİTE / TEMA
  2150,  // KONU
  2150,  // ÖĞRENME ÇIKTILARI
  1400,  // SÜREÇ BİLEŞENLERİ
  1150,  // ÖLÇME VE DEĞERLENDİRME
  900,   // SOSYAL-DUYGUSAL
  650,   // DEĞERLER
  950,   // OKURYAZARLIK BECERİLERİ
  1050,  // BELİRLİ GÜN VE HAFTALAR
  800,   // FARKLILAŞTIRMA
  1150,  // OKUL TEMELLİ PLANLAMA
];

function createCell(
  text: string,
  opts?: {
    bold?: boolean;
    center?: boolean;
    size?: number;
    shading?: string;
    columnSpan?: number;
    verticalAlign?: typeof VerticalAlign[keyof typeof VerticalAlign];
    borders?: {
      top?: { style: typeof BorderStyle[keyof typeof BorderStyle]; size: number; color: string };
      bottom?: { style: typeof BorderStyle[keyof typeof BorderStyle]; size: number; color: string };
      left?: { style: typeof BorderStyle[keyof typeof BorderStyle]; size: number; color: string };
      right?: { style: typeof BorderStyle[keyof typeof BorderStyle]; size: number; color: string };
    };
  }
): TableCell {
  return new TableCell({
    columnSpan: opts?.columnSpan,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
            size: opts?.size ?? 18,
            font: 'Calibri',
          }),
        ],
        alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      }),
    ],
    shading: opts?.shading ? { fill: opts.shading } : undefined,
    verticalAlign: (opts?.verticalAlign as any) ?? VerticalAlign.CENTER,
    margins: {
      top: 80,
      bottom: 80,
      left: 80,
      right: 80,
    },
    borders: opts?.borders,
  });
}

const LIGHT_GREEN = 'D4EDDA';
const LIGHT_GREY = 'E8ECF0';

async function main() {
  // Başlık satırı 1 – üst kategori (açık yeşil, birleştirilmiş)
  const headerRow1 = new TableRow({
    children: HEADER_ROW1.map((item) =>
      createCell(item.text, {
        bold: true,
        center: true,
        shading: LIGHT_GREEN,
        size: 16,
        columnSpan: item.columnSpan,
        verticalAlign: VerticalAlign.CENTER,
      })
    ),
    tableHeader: true,
    height: { value: 400, rule: 'atLeast' },
  });
  // Başlık satırı 2 – sütun adları (açık gri)
  const headerRow2 = new TableRow({
    children: COLUMN_HEADERS.map((h) =>
      createCell(h, {
        bold: true,
        center: true,
        shading: LIGHT_GREY,
        size: 16,
        verticalAlign: VerticalAlign.CENTER,
      })
    ),
    tableHeader: true,
    height: { value: 550, rule: 'atLeast' },
  });

  // Veri satırı – docxtemplater döngüsü için template row
  const dataRow = new TableRow({
    children: [
      createCell('{#haftalar}{ay}', {
        center: true,
        size: 18,
        verticalAlign: VerticalAlign.CENTER,
      }),
      createCell('{hafta_label}', {
        center: true,
        size: 18,
        verticalAlign: VerticalAlign.CENTER,
      }),
      createCell('{ders_saati}', {
        center: true,
        size: 18,
        verticalAlign: VerticalAlign.CENTER,
      }),
      createCell('{unite}', {
        center: true,
        size: 18,
        verticalAlign: VerticalAlign.CENTER,
      }),
      createCell('{konu}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{ogrenme_ciktilari}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{surec_bilesenleri}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{olcme_degerlendirme}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{sosyal_duygusal}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{degerler}', {
        center: true,
        size: 18,
        verticalAlign: VerticalAlign.CENTER,
      }),
      createCell('{okuryazarlik_becerileri}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{belirli_gun_haftalar}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{zenginlestirme}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
      createCell('{okul_temelli_planlama}{/haftalar}', {
        size: 18,
        verticalAlign: VerticalAlign.TOP,
      }),
    ],
    height: { value: 600, rule: 'atLeast' },
  });

  const planTable = new Table({
    rows: [headerRow1, headerRow2, dataRow],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: COL_WIDTHS,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    },
  });

  // Onay kutusu – dinamik zümre sayısı + müdür (çizgisiz, sadece isimler)
  // docxtemplater ile {#zumre_list}{isim}{/zumre_list} döngüsü kullanacağız
  const onayTable = new Table({
    rows: [
      new TableRow({
        children: [
          // Zümre öğretmenleri döngüsü - docxtemplater {#zumre_list}...{/zumre_list}
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '{#zumre_list}{isim}', size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: '{ders_adi} Öğretmeni{/zumre_list}', size: 20 })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 300, bottom: 300, left: 100, right: 100 },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
          }),
          // Müdür onayı
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '{onay_tarihi_alt}', size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'UYGUNDUR', bold: true, size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [new TextRun({ text: '{mudur_adi}', size: 20 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'Okul Müdürü', size: 20 })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 300, bottom: 300, left: 100, right: 100 },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.35),
              right: convertInchesToTwip(0.3),
              bottom: convertInchesToTwip(0.35),
              left: convertInchesToTwip(0.3),
            },
            size: {
              // Word A4 portrait ölçüleri + LANDSCAPE => gerçek yatay sayfa
              width: 11906,
              height: 16838,
              orientation: PageOrientation.LANDSCAPE,
            },
          },
        },
        children: [
          // Başlık – temiz, tek satır
          new Paragraph({
            children: [
              new TextRun({
                text: '{okul_adi} {ogretim_yili} EĞİTİM-ÖĞRETİM YILI {sinif}. SINIF',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '{ders_adi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          // Plan tablosu
          planTable,
          // Boşluk
          new Paragraph({ spacing: { after: 400 } }),
          // Onay kutusu
          onayTable,
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
  const outPath = path.join(TEMPLATES_DIR, OUT_FILE);
  fs.writeFileSync(outPath, buf);
  console.log('✓ Modern şablon oluşturuldu:', outPath);
  console.log('✓ Özellikler:');
  console.log('  - Gereksiz nokta satırları yok');
  console.log('  - Sütunlar içeriğe göre otomatik hizalı');
  console.log('  - Yazılar kesilmeden tam görünür');
  console.log('  - Onay kutusu altta (zümre + müdür)');
  console.log('  - Okunabilir font (Calibri 18-24pt)');
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
