import { Document as DocxDocument, Packer, Paragraph, TextRun, Table, TableCell, TableRow, AlignmentType, VerticalAlign, BorderStyle, WidthType, PageOrientation, convertInchesToTwip } from 'docx';
import { TABLE_STYLES, HEADER_STYLES, CELL_STYLES, TABLE_LAYOUT, TEXT_STYLES, ORIENTATION } from './document-template-defaults';

function buildYillikPlanHeaderRow2(surecCellLabel: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'AY', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'HAFTA', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DERS SAATİ', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÜNİTE / TEMA', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'KONU', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖĞRENME\nÇIKTILARI', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: surecCellLabel, size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖLÇME / DEĞERLENDİRME', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SOSYAL-DUYG.\nÖĞR.', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DEĞERLER', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKURYAZAR.\nBECERİ', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BELİRLİ GÜN\n/ HAFTA', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FARKLILAŞTIRMA', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKUL TEM.\nPLANL.', size: HEADER_STYLES.HEADER_SIZE_NARROW, font: TEXT_STYLES.FONT })] })], shading: { fill: TABLE_STYLES.LIGHT_GRAY } }),
    ],
  });
}

function buildYillikPlanSampleRow(): TableRow {
  return new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ay}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{hafta_label}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ders_saati}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{unite}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{konu}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{ogrenme_ciktilari}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{surec_bilesenleri}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{olcme_degerlendirme}', size: CELL_STYLES.CELL_SIZE, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{sosyal_duygusal}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{degerler}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{okuryazarlik_becerileri}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{belirli_gun_haftalar}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{zenginlestirme}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '{okul_temelli_planlama}', size: CELL_STYLES.CELL_SIZE_SMALL, font: TEXT_STYLES.FONT })] })], verticalAlign: VerticalAlign.CENTER }),
    ],
  });
}

/**
 * Generate MEB-compatible yearly plan Word template
 */
export async function generateMebYillikPlanTemplate(): Promise<Buffer> {
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    insideHorizontal: { style: BorderStyle.SINGLE, size: TABLE_STYLES.INNER_BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    insideVertical: { style: BorderStyle.SINGLE, size: TABLE_STYLES.INNER_BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
  };

  const headerRow1 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SÜRE', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 2, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DERS SAATİ · ÜNİTE/TEMA · KONU', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 3, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖĞRENME ÇIKTILARI / SÜREÇ BİLEŞENLERİ', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 2, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖLÇME VE DEĞERLENDİRME', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'PROGRAMLAR ARASI BİLEŞENLER', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 3, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BELİRLİ GÜN VE HAFTALAR', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FARKLILAŞTIRMA', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKUL TEMELLİ PLANLAMA', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
    ],
  });

  const headerRow2 = buildYillikPlanHeaderRow2('SÜREÇ\nBİLEŞENLERİ');
  const sampleRow = buildYillikPlanSampleRow();

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          size: { width: ORIENTATION.PAGE_WIDTH, height: ORIENTATION.PAGE_HEIGHT, orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: convertInchesToTwip(ORIENTATION.MARGIN_TOP),
            right: convertInchesToTwip(ORIENTATION.MARGIN_RIGHT),
            bottom: convertInchesToTwip(ORIENTATION.MARGIN_BOTTOM),
            left: convertInchesToTwip(ORIENTATION.MARGIN_LEFT),
          },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: '{okul_adi} {ogretim_yili} EĞİTİM-ÖĞRETİM YILI {sinif}. SINIF', bold: true, size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: '{ders_adi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI', bold: true, size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Table({
          layout: 'fixed' as any,
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: TABLE_LAYOUT.COL_WIDTHS,
          rows: [headerRow1, headerRow2, sampleRow],
          borders: tableBorders,
        }),
        new Paragraph({ spacing: { after: 220 } }),
        new Paragraph({
          children: [new TextRun({ text: '{mudur_adi}', size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Okul Müdürü', size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function generateBilsemYillikPlanTemplate(): Promise<Buffer> {
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    insideHorizontal: { style: BorderStyle.SINGLE, size: TABLE_STYLES.INNER_BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
    insideVertical: { style: BorderStyle.SINGLE, size: TABLE_STYLES.INNER_BORDER_SIZE, color: TABLE_STYLES.BORDER_COLOR },
  };

  const headerRow1 = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SÜRE', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 2, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DERS SAATİ · ÜNİTE/TEMA · KONU', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 3, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖĞRENME ÇIKTILARI / SÜREÇ BİLEŞENLERİ', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 2, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ÖLÇME VE DEĞERLENDİRME', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'PROGRAMLAR ARASI BİLEŞENLER', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 3, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BELİRLİ GÜN VE HAFTALAR', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FARKLILAŞTIRMA', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'OKUL TEMELLİ PLANLAMA', size: HEADER_STYLES.HEADER_SIZE, font: TEXT_STYLES.FONT })] })], columnSpan: 1, shading: { fill: TABLE_STYLES.LIGHT_GREEN } }),
    ],
  });

  const headerRow2 = buildYillikPlanHeaderRow2('SÜREÇ');
  const sampleRow = buildYillikPlanSampleRow();

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          size: { width: ORIENTATION.PAGE_WIDTH, height: ORIENTATION.PAGE_HEIGHT, orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: convertInchesToTwip(ORIENTATION.MARGIN_TOP),
            right: convertInchesToTwip(ORIENTATION.MARGIN_RIGHT),
            bottom: convertInchesToTwip(ORIENTATION.MARGIN_BOTTOM),
            left: convertInchesToTwip(ORIENTATION.MARGIN_LEFT),
          },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: '{okul_adi} {ogretim_yili} EĞİTİM-ÖĞRETİM YILI {sinif} GRUP', bold: true, size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: '{ders_adi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI', bold: true, size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Table({
          layout: 'fixed' as any,
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: TABLE_LAYOUT.COL_WIDTHS,
          rows: [headerRow1, headerRow2, sampleRow],
          borders: tableBorders,
        }),
        new Paragraph({ spacing: { after: 220 } }),
        new Paragraph({
          children: [new TextRun({ text: '{mudur_adi}', size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Okul Müdürü', size: 20, font: TEXT_STYLES.FONT })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
