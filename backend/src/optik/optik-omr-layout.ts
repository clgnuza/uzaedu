/** PWA/kamera OMR — PDF (omr-v3) ile aynı balon geometrisi, normalize 0–1 (sol-üst köşe). */

export const OMR_LAYOUT_VERSION = 'omr-v3';
export const OMR_PAGE_WIDTH = 595.28;
export const OMR_PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const FOOTER_H = 28;
const ALIGN_STRIP_W = 8;
const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface TestBlock {
  label: string;
  questionCount: number;
  choiceCount: number;
}

export function normalizeTestBlocks(blocks: TestBlock[]): TestBlock[] {
  const raw = Array.isArray(blocks) ? blocks : [];
  const out: TestBlock[] = [];
  for (const b of raw) {
    const qc = Number(b.questionCount);
    const cc = Number(b.choiceCount);
    const q = Math.max(1, Math.min(200, Number.isFinite(qc) ? qc : 20));
    const c = Math.max(1, Math.min(6, Number.isFinite(cc) ? cc : 5));
    const label = String(b.label ?? 'CEVAPLAR').trim() || 'CEVAPLAR';
    out.push({ label, questionCount: q, choiceCount: c });
  }
  return out.length > 0 ? out : [{ label: 'CEVAPLAR', questionCount: 20, choiceCount: 5 }];
}

const LGS_BLOCKS: TestBlock[] = [
  { label: 'Türkçe', questionCount: 20, choiceCount: 4 },
  { label: 'Matematik', questionCount: 20, choiceCount: 4 },
  { label: 'Fen Bilimleri', questionCount: 20, choiceCount: 4 },
  { label: 'TC İnkılap Tarihi', questionCount: 10, choiceCount: 4 },
  { label: 'Din Kültürü', questionCount: 10, choiceCount: 4 },
  { label: 'Yabancı Dil', questionCount: 10, choiceCount: 4 },
];

const YKS_TYT_BLOCKS: TestBlock[] = [
  { label: 'Türkçe', questionCount: 40, choiceCount: 4 },
  { label: 'Sosyal Bilimler', questionCount: 20, choiceCount: 4 },
  { label: 'Temel Matematik', questionCount: 40, choiceCount: 4 },
  { label: 'Fen Bilimleri', questionCount: 20, choiceCount: 4 },
];

export function resolveTestBlocks(template: {
  questionCount?: number;
  choiceCount?: number;
  gradeLevel?: string | null;
  slug?: string;
  roiConfig?: { test_blocks?: TestBlock[] } | null;
}): TestBlock[] {
  if (Array.isArray(template.roiConfig?.test_blocks) && template.roiConfig.test_blocks.length > 0) {
    return normalizeTestBlocks(template.roiConfig.test_blocks);
  }
  if (template.gradeLevel === 'LGS' || /^lgs/i.test(String(template.slug ?? ''))) {
    return [...LGS_BLOCKS];
  }
  if (
    (template.gradeLevel === 'YKS' || /^yks/i.test(String(template.slug ?? ''))) &&
    /tyt|120/i.test(String(template.slug ?? ''))
  ) {
    return [...YKS_TYT_BLOCKS];
  }
  const q = Math.max(1, Number(template.questionCount) || 20);
  const c = Math.max(1, Math.min(Number(template.choiceCount) || 5, 6));
  return [{ label: 'CEVAPLAR', questionCount: q, choiceCount: c }];
}

/** pdf-lib Y (alttan) → görüntü Y (üstten), normalize */
function pdfYToNorm(py: number): number {
  return (OMR_PAGE_HEIGHT - py) / OMR_PAGE_HEIGHT;
}

function normX(px: number): number {
  return px / OMR_PAGE_WIDTH;
}

export type OmrScanBubble = {
  question: number;
  choice: number;
  label: string;
  x: number;
  y: number;
  r: number;
};

export type OmrScanLayout = {
  version: string;
  page_width: number;
  page_height: number;
  anchors: Array<{ x: number; y: number; size: number }>;
  bubbles: OmrScanBubble[];
  question_count: number;
  blocks: TestBlock[];
};

/** PDF buildSinglePageFormDocument ile uyumlu cevap balonları */
export function computeOmrScanLayout(template: {
  questionCount?: number;
  choiceCount?: number;
  gradeLevel?: string | null;
  slug?: string;
  roiConfig?: { test_blocks?: TestBlock[] } | null;
}): OmrScanLayout {
  const blocks = resolveTestBlocks(template);
  const questionCount = blocks.reduce((s, b) => s + b.questionCount, 0);
  const pageWidth = OMR_PAGE_WIDTH;
  const pageHeight = OMR_PAGE_HEIGHT;
  const margin = MARGIN;

  const inset = 10;
  const marker = 7;
  const anchors = [
    { x: normX(inset), y: pdfYToNorm(pageHeight - inset), size: marker / pageWidth },
    { x: normX(pageWidth - inset - marker), y: pdfYToNorm(pageHeight - inset), size: marker / pageWidth },
    { x: normX(inset), y: pdfYToNorm(inset + marker), size: marker / pageWidth },
    { x: normX(pageWidth - inset - marker), y: pdfYToNorm(inset + marker), size: marker / pageWidth },
  ];

  let y = pageHeight - margin;
  const headerHeight = 40;
  y -= headerHeight + 18;

  const contentX = margin + ALIGN_STRIP_W + 12;
  const contentW = pageWidth - margin - contentX;
  const cardPad = 16;
  const cardInnerX = contentX + cardPad;
  const cardInnerW = contentW - 2 * cardPad;
  const idRowHeight = 11;
  const idBubbleSize = 4;
  const idMinChoiceSpacing = 2 * idBubbleSize + 3.5;
  const idOptionHeaderH = 10;
  const idDigitRows = 5;
  const idLabelColW = 20;
  const idColGap = 12;
  const idColW = (cardInnerW - idColGap) / 2;
  const idFieldLabelW = 72;
  const cardHeaderH = 22;
  const kitapcikBlockH = idOptionHeaderH + idRowHeight;
  const sinifBlockH = 2 * (idOptionHeaderH + idRowHeight);
  const leftColBodyH = 3 * idRowHeight + kitapcikBlockH + sinifBlockH + 12;
  const rightColBodyH = idOptionHeaderH + idDigitRows * idRowHeight + 14;
  const cardBodyH = Math.max(leftColBodyH, rightColBodyH) + 8;
  const topBlockH = cardHeaderH + cardBodyH;
  y = y - topBlockH - 12;

  const cevaplarX = contentX;
  const cevaplarWidth = contentW;
  const sectionHeight = 20;
  const blockHeaderH = 14;
  const optionHeaderH = 10;
  const colGap = 8;

  let numCols = questionCount >= 100 ? 5 : questionCount >= 70 ? 4 : questionCount >= 35 ? 3 : 2;
  const maxChoiceCount = Math.max(1, ...blocks.map((b) => Math.max(1, Math.min(6, b.choiceCount))));
  const minBubbleSize = 3.8;
  const minChoiceSpacing = 2 * minBubbleSize + 3;
  while (numCols > 2) {
    const qw = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
    const minCellW = 18 + maxChoiceCount * minChoiceSpacing + 8;
    if (qw >= minCellW) break;
    numCols -= 1;
  }

  const totalRows = blocks.reduce((s, b) => s + Math.ceil(b.questionCount / numCols), 0);
  const fixedH = sectionHeight + blocks.length * (blockHeaderH + optionHeaderH + 8) + 10;
  const availableH = Math.max(140, y - margin - FOOTER_H - 8);
  const rowHeight = Math.max(9, Math.min(12, Math.floor((availableH - fixedH) / Math.max(1, totalRows))));
  const answerBubble = Math.max(3.6, Math.min(4.8, rowHeight * 0.36));
  const questionWidth = (cevaplarWidth - (numCols - 1) * colGap) / numCols;
  const numberW = 18;
  const innerPad = 8;

  y -= sectionHeight + 10;

  const bubbles: OmrScanBubble[] = [];
  let globalQ = 0;

  for (const blk of blocks) {
    const blkChoiceCount = Math.max(1, Math.min(blk.choiceCount, 6));
    const rowsPerCol = Math.ceil(blk.questionCount / numCols);
    const blockBodyH = rowsPerCol * rowHeight;

    if ((blk.label || '').toLocaleUpperCase('tr-TR') !== 'CEVAPLAR') {
      y -= blockHeaderH;
    }
    y -= optionHeaderH;
    const rowsTop = y;

    for (let q = 0; q < blk.questionCount; q++) {
      globalQ += 1;
      const col = Math.floor(q / rowsPerCol);
      const row = q % rowsPerCol;
      const xColLeft = cevaplarX + col * (questionWidth + colGap);
      const rowCenterY = rowsTop - row * rowHeight - rowHeight / 2;
      const choiceW = Math.max(minChoiceSpacing, (questionWidth - numberW - innerPad) / blkChoiceCount);

      for (let c = 0; c < blkChoiceCount; c++) {
        const cx = xColLeft + numberW + c * choiceW + choiceW / 2;
        bubbles.push({
          question: globalQ,
          choice: c,
          label: CHOICE_LABELS[c] ?? String(c + 1),
          x: normX(cx),
          y: pdfYToNorm(rowCenterY),
          r: answerBubble / pageWidth,
        });
      }
    }
    y -= blockBodyH + 8;
  }

  return {
    version: OMR_LAYOUT_VERSION,
    page_width: pageWidth,
    page_height: pageHeight,
    anchors,
    bubbles,
    question_count: questionCount,
    blocks,
  };
}
