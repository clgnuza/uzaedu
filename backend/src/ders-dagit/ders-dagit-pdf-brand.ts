import type { PDFPage, PDFFont, RGB } from 'pdf-lib';
import { rgb } from 'pdf-lib';

/** Kurumsal palet — lacivert + amber vurgu (özgün, MEB uyumlu) */
export type BrandPalette = {
  ink: RGB;
  muted: RGB;
  faint: RGB;
  border: RGB;
  borderLight: RGB;
  primary: RGB;
  primaryDark: RGB;
  accent: RGB;
  accentSoft: RGB;
  surface: RGB;
  surfaceRaised: RGB;
  headerFill: RGB;
  headerInk: RGB;
  altRow: RGB;
  emptyCell: RGB;
  white: RGB;
};

export function brandPalette(color: boolean): BrandPalette {
  if (!color) {
    return {
      ink: rgb(0.07, 0.07, 0.09),
      muted: rgb(0.38, 0.38, 0.4),
      faint: rgb(0.55, 0.55, 0.57),
      border: rgb(0.22, 0.22, 0.24),
      borderLight: rgb(0.78, 0.78, 0.8),
      primary: rgb(0.12, 0.12, 0.14),
      primaryDark: rgb(0.05, 0.05, 0.06),
      accent: rgb(0.25, 0.25, 0.28),
      accentSoft: rgb(0.92, 0.92, 0.93),
      surface: rgb(0.98, 0.98, 0.99),
      surfaceRaised: rgb(0.94, 0.94, 0.95),
      headerFill: rgb(0.88, 0.88, 0.9),
      headerInk: rgb(0.1, 0.1, 0.12),
      altRow: rgb(0.96, 0.96, 0.97),
      emptyCell: rgb(0.99, 0.99, 1),
      white: rgb(1, 1, 1),
    };
  }
  return {
    ink: rgb(0.09, 0.11, 0.16),
    muted: rgb(0.35, 0.4, 0.5),
    faint: rgb(0.55, 0.6, 0.68),
    border: rgb(0.72, 0.76, 0.82),
    borderLight: rgb(0.88, 0.9, 0.93),
    primary: rgb(0.1, 0.28, 0.42),
    primaryDark: rgb(0.06, 0.18, 0.3),
    accent: rgb(0.78, 0.52, 0.12),
    accentSoft: rgb(0.98, 0.94, 0.86),
    surface: rgb(0.99, 0.995, 1),
    surfaceRaised: rgb(0.96, 0.97, 0.99),
    headerFill: rgb(0.1, 0.28, 0.42),
    headerInk: rgb(1, 1, 1),
    altRow: rgb(0.97, 0.98, 0.995),
    emptyCell: rgb(0.985, 0.988, 0.995),
    white: rgb(1, 1, 1),
  };
}

const SUBJECT_FILLS_COLOR: RGB[] = [
  rgb(0.88, 0.93, 0.98),
  rgb(0.95, 0.9, 0.88),
  rgb(0.9, 0.96, 0.9),
  rgb(0.96, 0.92, 0.98),
  rgb(0.98, 0.95, 0.88),
  rgb(0.9, 0.94, 0.96),
  rgb(0.94, 0.9, 0.94),
  rgb(0.92, 0.96, 0.94),
  rgb(0.96, 0.94, 0.9),
  rgb(0.9, 0.92, 0.98),
  rgb(0.98, 0.92, 0.92),
  rgb(0.93, 0.95, 0.88),
];

const SUBJECT_STRIPE_COLOR: RGB[] = [
  rgb(0.15, 0.45, 0.72),
  rgb(0.72, 0.35, 0.2),
  rgb(0.22, 0.58, 0.38),
  rgb(0.52, 0.32, 0.68),
  rgb(0.78, 0.52, 0.12),
  rgb(0.2, 0.5, 0.62),
  rgb(0.55, 0.28, 0.55),
  rgb(0.28, 0.55, 0.48),
  rgb(0.62, 0.45, 0.28),
  rgb(0.32, 0.42, 0.75),
  rgb(0.75, 0.28, 0.32),
  rgb(0.45, 0.58, 0.22),
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function subjectCellStyle(subject: string, colorMode: boolean): { fill: RGB; stripe: RGB } {
  const i = hashStr(subject) % 12;
  if (!colorMode) {
    const v = 0.93 + (i % 3) * 0.02;
    return { fill: rgb(v, v, v + 0.01), stripe: rgb(0.35, 0.35, 0.38) };
  }
  return { fill: SUBJECT_FILLS_COLOR[i]!, stripe: SUBJECT_STRIPE_COLOR[i]! };
}

export function drawPageChrome(
  page: PDFPage,
  pageW: number,
  pageH: number,
  margin: number,
  pal: BrandPalette,
) {
  page.drawRectangle({
    x: margin - 8,
    y: margin - 14,
    width: pageW - 2 * margin + 16,
    height: pageH - 2 * margin + 22,
    borderColor: pal.borderLight,
    borderWidth: 0.75,
  });
  page.drawRectangle({
    x: margin - 4,
    y: margin - 10,
    width: 5,
    height: pageH - 2 * margin + 14,
    color: pal.primary,
  });
  page.drawRectangle({
    x: margin - 4,
    y: pageH - margin - 3,
    width: pageW - 2 * margin + 8,
    height: 1.5,
    color: pal.accent,
  });
}

export function drawBrandWatermark(
  page: PDFPage,
  pageW: number,
  margin: number,
  font: PDFFont,
  pal: BrandPalette,
) {
  const t = 'ÖğretmenPro · Ders Dağıtım';
  const tw = font.widthOfTextAtSize(t, 6);
  page.drawText(t, {
    x: pageW - margin - tw,
    y: margin - 2,
    size: 6,
    font,
    color: pal.faint,
  });
}

export function drawTitleBadge(
  page: PDFPage,
  cx: number,
  y: number,
  title: string,
  fontBold: PDFFont,
  pal: BrandPalette,
  maxW = 480,
): number {
  const t = title.slice(0, 72);
  const size = t.length > 48 ? 9 : t.length > 36 ? 10 : 11;
  const tw = Math.min(fontBold.widthOfTextAtSize(t, size), maxW - 28);
  const padX = 10;
  const padY = 4;
  const w = tw + padX * 2;
  const h = size + padY * 2;
  page.drawRectangle({
    x: cx - w / 2,
    y: y - h + padY,
    width: w,
    height: h,
    color: pal.accentSoft,
    borderColor: pal.accent,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: cx - w / 2,
    y: y - h + padY,
    width: 3,
    height: h,
    color: pal.accent,
  });
  page.drawText(t, {
    x: cx - tw / 2,
    y: y - h + padY + 5,
    size,
    font: fontBold,
    color: pal.primaryDark,
  });
  return y - h - 5;
}

export function drawMetaChips(
  page: PDFPage,
  cx: number,
  y: number,
  chips: string[],
  font: PDFFont,
  pal: BrandPalette,
  maxTotalW = 500,
): number {
  if (!chips.length) return y;
  const gap = 6;
  const chipH = 13;
  const fontSize = 7;
  const padX = 6;
  const slice = chips.slice(0, 3);
  const maxChipInner = Math.max(
    40,
    Math.floor((maxTotalW - gap * Math.max(0, slice.length - 1)) / slice.length) - padX * 2,
  );
  const labels = slice.map((c) => {
    const t = c.trim();
    const text =
      font.widthOfTextAtSize(t, fontSize) <= maxChipInner
        ? t
        : (() => {
            let s = t;
            while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, fontSize) > maxChipInner) s = s.slice(0, -1);
            return `${s}…`;
          })();
    const w = font.widthOfTextAtSize(text, fontSize) + padX * 2;
    return { text, w };
  });
  const totalW = labels.reduce((s, l) => s + l.w, 0) + gap * (labels.length - 1);
  let x = cx - totalW / 2;
  const boxY = y - chipH;
  for (const l of labels) {
    page.drawRectangle({
      x,
      y: boxY,
      width: l.w,
      height: chipH,
      color: pal.surfaceRaised,
      borderColor: pal.borderLight,
      borderWidth: 0.35,
    });
    page.drawText(l.text, {
      x: x + padX,
      y: boxY + 3,
      size: fontSize,
      font,
      color: pal.muted,
    });
    x += l.w + gap;
  }
  return boxY - 6;
}

export function drawSignatureBlock(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  label: string,
  nameLine: string | undefined,
  font: PDFFont,
  fontBold: PDFFont,
  pal: BrandPalette,
) {
  page.drawRectangle({
    x,
    y: y - 56,
    width: w,
    height: 56,
    color: pal.surface,
    borderColor: pal.borderLight,
    borderWidth: 0.6,
  });
  page.drawText(label, { x: x + 10, y: y - 18, size: 8, font: fontBold, color: pal.primary });
  const line = nameLine?.trim() || '_________________________';
  page.drawText(line.slice(0, 42), { x: x + 10, y: y - 38, size: 8, font, color: pal.ink });
  page.drawText('İmza', { x: x + 10, y: y - 50, size: 6.5, font, color: pal.faint });
}
