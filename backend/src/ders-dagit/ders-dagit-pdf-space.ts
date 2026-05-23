/** PDF sayfa içi güvenli alan — içerik / footer çakışmasını önler */

export const PDF_FOOTER_RESERVE = 48;
/** beginProPage sonrası üst başlık için ayrılan tahmini yükseklik (pt) */
export const PDF_HEADER_RESERVE = 76;
/** Çarşaf / yoğun tablo sayfaları — kompakt başlık */
export const PDF_COMPACT_HEADER_RESERVE = 62;
export const PDF_HEADER_GAP = 8;
export const PDF_CELL_PAD = 3;

export function contentBottom(margin: number): number {
  return margin + PDF_FOOTER_RESERVE;
}

export function scheduleTableHeight(rowH: number, lessonCount: number): number {
  return rowH * (lessonCount + 1);
}

export function fitScheduleRowHeight(topY: number, bottomY: number, lessonCount: number, prefer = 34): number {
  const avail = topY - bottomY;
  if (avail <= 0) return 18;
  const maxRH = Math.floor(avail / (lessonCount + 1));
  return Math.min(prefer, Math.max(22, maxRH));
}

export function fitMasterRowHeight(
  pageH: number,
  margin: number,
  headerUsed: number,
  rowCount: number,
  headerRows = 2,
  prefer = 22,
): number {
  const bottom = contentBottom(margin);
  const avail = pageH - margin - headerUsed - bottom;
  const maxRH = Math.floor(avail / Math.max(1, rowCount + headerRows));
  return Math.min(prefer, Math.max(20, maxRH));
}

export function masterRowsPerPage(
  pageH: number,
  margin: number,
  headerUsed: number,
  rowH: number,
  headerRows = 2,
): number {
  const bottom = contentBottom(margin);
  const avail = pageH - margin - headerUsed - bottom;
  return Math.max(4, Math.floor(avail / rowH) - headerRows);
}
