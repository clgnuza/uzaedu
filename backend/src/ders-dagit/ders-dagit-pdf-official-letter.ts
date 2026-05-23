import type { PDFPage, PDFFont } from 'pdf-lib';
import { truncateToWidth } from './ders-dagit-pdf-layout';
import type { BrandPalette } from './ders-dagit-pdf-brand';

/** Resmi Yazışma Usulü — tarih (gg.aa.yyyy) */
export function formatOfficialDate(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

export type OfficialLetterheadOpts = {
  school_name: string;
  document_title: string;
  academic_year?: string | null;
};

/** T.C. / MEB / okul — süsleme yok, çizgisel alt çizgi */
export function drawOfficialLetterhead(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  opts: OfficialLetterheadOpts,
  pal: BrandPalette,
): number {
  const cx = pageW / 2;
  let y = pageH - margin - 6;

  const tc = 'T.C.';
  const tcSize = 9;
  const tcW = fontBold.widthOfTextAtSize(tc, tcSize);
  page.drawText(tc, { x: cx - tcW / 2, y, size: tcSize, font: fontBold, color: pal.ink });
  y -= 12;

  const meb = 'MİLLÎ EĞİTİM BAKANLIĞI';
  const mebSize = 8;
  const mebW = fontBold.widthOfTextAtSize(meb, mebSize);
  page.drawText(meb, { x: cx - mebW / 2, y, size: mebSize, font: fontBold, color: pal.ink });
  y -= 13;

  const school = truncateToWidth(opts.school_name, fontBold, 12, pageW - 2 * margin - 24);
  const schoolSize = school.length > 44 ? 10.5 : 12;
  const schoolW = fontBold.widthOfTextAtSize(school, schoolSize);
  page.drawText(school, { x: cx - schoolW / 2, y, size: schoolSize, font: fontBold, color: pal.ink });
  y -= schoolSize + 6;

  const title = truncateToWidth(opts.document_title, fontBold, 10, pageW - 2 * margin - 32);
  const titleSize = title.length > 50 ? 9.5 : 10.5;
  const titleW = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: cx - titleW / 2, y, size: titleSize, font: fontBold, color: pal.ink });
  y -= titleSize + 4;

  if (opts.academic_year?.trim()) {
    const ay = `${opts.academic_year.trim()} Eğitim-Öğretim Yılı`;
    const ayT = truncateToWidth(ay, font, 8, pageW - 2 * margin - 32);
    const ayW = font.widthOfTextAtSize(ayT, 8);
    page.drawText(ayT, { x: cx - ayW / 2, y, size: 8, font, color: pal.muted });
    y -= 10;
  }

  page.drawLine({
    start: { x: margin, y: y - 2 },
    end: { x: pageW - margin, y: y - 2 },
    thickness: 0.6,
    color: pal.border,
  });
  return y - 14;
}

export type OfficialReferenceOpts = {
  sayi: string;
  konu: string;
  tarih: string;
};

/** Sayı (sol) + Tarih (sağ); alt satır Konu */
export function drawOfficialReferenceBlock(
  page: PDFPage,
  pageW: number,
  y: number,
  margin: number,
  font: PDFFont,
  fontBold: PDFFont,
  ref: OfficialReferenceOpts,
  pal: BrandPalette,
): number {
  const left = margin + 4;
  const right = pageW - margin - 4;
  const labelSize = 9;
  const valueSize = 9;
  const labelW = 38;

  const drawRow = (label: string, value: string, yy: number, valueMaxW: number) => {
    page.drawText(label, { x: left, y: yy, size: labelSize, font: fontBold, color: pal.ink });
    page.drawText(':', { x: left + labelW - 6, y: yy, size: labelSize, font: fontBold, color: pal.ink });
    const val = truncateToWidth(value, font, valueSize, valueMaxW);
    page.drawText(val, { x: left + labelW, y: yy, size: valueSize, font, color: pal.ink });
  };

  const tarihLabel = 'Tarih';
  const tarihVal = ref.tarih;
  const tarihValW = font.widthOfTextAtSize(tarihVal, valueSize);
  page.drawText(tarihVal, { x: right - tarihValW, y, size: valueSize, font, color: pal.ink });
  const tarihLblW = fontBold.widthOfTextAtSize(tarihLabel, labelSize);
  page.drawText(tarihLabel, {
    x: right - tarihValW - tarihLblW - 6,
    y,
    size: labelSize,
    font: fontBold,
    color: pal.ink,
  });
  page.drawText(':', {
    x: right - tarihValW - tarihLblW - 10,
    y,
    size: labelSize,
    font: fontBold,
    color: pal.ink,
  });

  drawRow('Sayı', ref.sayi, y, pageW - 2 * margin - labelW - 120);
  y -= 14;
  drawRow('Konu', ref.konu, y, pageW - 2 * margin - labelW - 8);
  return y - 16;
}
