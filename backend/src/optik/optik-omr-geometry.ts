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
