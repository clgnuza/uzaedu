/** PDF + scan-layout ortak OMR geometrisi (omr-v4) */

export const OMR_LAYOUT_VERSION = 'omr-v4';

export const OMR_PAGE_WIDTH = 595.28;
export const OMR_PAGE_HEIGHT = 841.89;

export const OMR_ANCHOR_SIZE = 8;
export const OMR_ANCHOR_INSET = 10;

/** Cevap balonları — tarama için biraz büyük */
export const OMR_ANSWER_MIN_BUBBLE = 4.5;
export const OMR_ANSWER_MAX_BUBBLE = 5.8;
export const OMR_ANSWER_BUBBLE_ROW_FACTOR = 0.44;
export const OMR_ROW_HEIGHT_MIN = 10;
export const OMR_ROW_HEIGHT_MAX = 14;

export const OMR_ID_BUBBLE_SIZE = 4.5;
export const OMR_ID_LABEL_COL_W = 20;
export const OMR_ID_DIGIT_ROWS = 5;

export type IdDigitBubble = {
  digit_index: number;
  value: number;
  label: string;
  x: number;
  y: number;
  r: number;
};
export const OMR_NUMBER_COL_W = 20;
export const OMR_INNER_PAD = 8;
export const OMR_COL_GAP = 8;

export function computeMinChoiceSpacing(): number {
  return 2 * OMR_ANSWER_MIN_BUBBLE + 4;
}

export function computeAnswerRowHeight(
  availableH: number,
  fixedH: number,
  totalRows: number,
): number {
  return Math.max(
    OMR_ROW_HEIGHT_MIN,
    Math.min(OMR_ROW_HEIGHT_MAX, Math.floor((availableH - fixedH) / Math.max(1, totalRows))),
  );
}

export function computeAnswerBubbleSize(rowHeight: number): number {
  return Math.max(
    OMR_ANSWER_MIN_BUBBLE - 0.3,
    Math.min(OMR_ANSWER_MAX_BUBBLE, rowHeight * OMR_ANSWER_BUBBLE_ROW_FACTOR),
  );
}

export function resolveAnswerColumnCount(questionCount: number): number {
  let numCols = questionCount >= 100 ? 5 : questionCount >= 70 ? 4 : questionCount >= 35 ? 3 : 2;
  return numCols;
}

/** PDF drawStudentNoGrid ile aynı — 5 hane × 0-9 */
export function computeStudentIdDigitBubbles(opts: {
  pageWidth: number;
  topBlockY: number;
  cardHeaderH: number;
  cardInnerX: number;
  cardInnerW: number;
  pdfYToNorm: (py: number) => number;
  normX: (px: number) => number;
}): IdDigitBubble[] {
  const idRowHeight = 11;
  const idBubbleSize = OMR_ID_BUBBLE_SIZE;
  const idMinChoiceSpacing = 2 * idBubbleSize + 3.5;
  const idOptionHeaderH = 10;
  const idLabelColW = OMR_ID_LABEL_COL_W;
  const idColGap = 12;
  const idColW = (opts.cardInnerW - idColGap) / 2;
  const colDivX = opts.cardInnerX + idColW + idColGap / 2;
  const rightColX = colDivX + idColGap / 2;
  const digitChoiceSpacing = Math.max(idMinChoiceSpacing, (idColW - idLabelColW - 12) / 10);
  const digitBlockTop = opts.topBlockY - opts.cardHeaderH - 8;
  const yTop = digitBlockTop - 6;
  const xGrid = rightColX + idLabelColW;
  const rowsTop = yTop - idOptionHeaderH;
  const r = idBubbleSize / opts.pageWidth;
  const out: IdDigitBubble[] = [];

  for (let digitIndex = 0; digitIndex < OMR_ID_DIGIT_ROWS; digitIndex++) {
    const rowCenterY = rowsTop - digitIndex * idRowHeight - idRowHeight / 2;
    for (let value = 0; value <= 9; value++) {
      const cx = xGrid + value * digitChoiceSpacing + digitChoiceSpacing / 2;
      out.push({
        digit_index: digitIndex,
        value,
        label: String(value),
        x: opts.normX(cx),
        y: opts.pdfYToNorm(rowCenterY),
        r,
      });
    }
  }
  return out;
}

export function fitAnswerColumnCount(
  numCols: number,
  cevaplarWidth: number,
  maxChoiceCount: number,
): number {
  const minChoiceSpacing = computeMinChoiceSpacing();
  let cols = numCols;
  while (cols > 2) {
    const qw = (cevaplarWidth - (cols - 1) * OMR_COL_GAP) / cols;
    const minCellW = OMR_NUMBER_COL_W + maxChoiceCount * minChoiceSpacing + OMR_INNER_PAD;
    if (qw >= minCellW) break;
    cols -= 1;
  }
  return cols;
}
