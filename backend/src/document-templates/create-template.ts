import { Document as DocxDocument, Packer, Paragraph, TextRun, Table, TableCell, TableRow, AlignmentType, VerticalAlign, BorderStyle, WidthType, PageOrientation, convertInchesToTwip } from 'docx';
import * as path from 'path';
import * as fs from 'fs';

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

const colWidths = [240, 260, 220, 280, 360, 1000, 600, 2180, 400, 350, 420, 450, 650, 700];

async function createMebTemplate(): Promise<Buffer> {
  const headerRow1 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SÜRE', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 2, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DERS SAATİ · ÜNİTE/TEMA · KONU', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 3, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖĞRENME ÇIKTILARI / SÜREÇ BİLEŞENLERİ', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 2, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖLÇME VE DEĞERLENDİRME', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 1, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'PROGRAMLAR ARASI BİLEŞENLER', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 3, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BELİRLİ GÜN VE HAFTALAR', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 1, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FARKLILAŞTIRMA', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 1, shading: { fill: 'D4EDDA' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKUL TEMELLİ PLANLAMA', size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })], columnSpan: 1, shading: { fill: 'D4EDDA' } }),
    ],
  });

  const headerRow2 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'AY', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'HAFTA', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DERS SAATİ', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÜNİTE / TEMA', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'KONU', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖĞRENME\nÇIKTILARI', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SÜREÇ\nBİLEŞENLERİ', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖLÇME / DEĞERLENDİRME', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SOSYAL-DUYG.\nÖĞR.', size: 12, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DEĞERLER', size: 12, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKURYAZAR.\nBECERİ', size: 12, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BELİRLİ GÜN\n/ HAFTA', size: 12, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FARKLILAŞTIRMA', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKUL TEM.\nPLANL.', size: 12, font: 'Calibri' })], alignment: AlignmentType.CENTER })], shading: { fill: 'E8ECF0' } }),
    ],
  });

  const sampleRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ay}', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{hafta_label}', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ders_saati}', size: 14, font: 'Calibri' })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{unite}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{konu}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ogrenme_ciktilari}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{surec_bilesenleri}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{olcme_degerlendirme}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{sosyal_duygusal}', size: 12, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{degerler}', size: 12, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{okuryazarlik_becerileri}', size: 12, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{belirli_gun_haftalar}', size: 12, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{zenginlestirme}', size: 14, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{okul_temelli_planlama}', size: 12, font: 'Calibri' })] })] }),
    ],
  });

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: convertInchesToTwip(0.35),
            right: convertInchesToTwip(0.3),
            bottom: convertInchesToTwip(0.35),
            left: convertInchesToTwip(0.3),
          },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: '{okul_adi} {ogretim_yili} EĞİTİM-ÖĞRETİM YILI {sinif}. SINIF', bold: true, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: '{ders_adi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI', bold: true, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Table({
          layout: 'fixed' as any,
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: colWidths,
          rows: [headerRow1, headerRow2, sampleRow],
          borders: tableBorders,
        }),
        new Paragraph({ spacing: { after: 220 } }),
        new Paragraph({
          children: [
            new TextRun({ text: '{ogretmen_adi}', size: 20, font: 'Calibri' }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '{ogretmen_unvani}', size: 20, font: 'Calibri' }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ spacing: { after: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '{onay_tarihi_alt}', size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'UYGUNDUR', bold: true, size: 24, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: '{mudur_adi}', size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Okul Müdürü', size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

void (async () => {
  const buffer = await createMebTemplate();
  const outputPath = path.join(__dirname, '../templates/yillik-plan-meb.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`MEB template saved to: ${outputPath}`);
})();
