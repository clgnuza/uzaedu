/**
 * PDF bölme yardımcısı.
 * pdf-lib kullanarak büyük PDF'i öğrenci/kişi başına küçük PDF'lere böler.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const _fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument } from 'pdf-lib';

export type SplitResult = {
  index: number;
  pageStart: number;
  pageEnd: number;
  buffer: Buffer;
};

/**
 * PDF'i her n sayfada bir böler.
 * @param sourceBuffer - kaynak PDF buffer
 * @param pagesPerDoc  - kişi başına sayfa sayısı (default: 1)
 * @returns SplitResult[]
 */
export async function splitPdfByPageCount(sourceBuffer: Buffer, pagesPerDoc = 1): Promise<SplitResult[]> {
  const sourcePdf  = await PDFDocument.load(sourceBuffer);
  const totalPages = sourcePdf.getPageCount();
  const results: SplitResult[] = [];

  for (let i = 0; i < totalPages; i += pagesPerDoc) {
    const pageEnd = Math.min(i + pagesPerDoc - 1, totalPages - 1);
    const newDoc  = await PDFDocument.create();
    const pageIdxs: number[] = [];
    for (let p = i; p <= pageEnd; p++) pageIdxs.push(p);
    const copied = await newDoc.copyPages(sourcePdf, pageIdxs);
    copied.forEach((page) => newDoc.addPage(page));
    const bytes = await newDoc.save();
    results.push({ index: Math.floor(i / pagesPerDoc), pageStart: i, pageEnd, buffer: Buffer.from(bytes) });
  }
  return results;
}

/**
 * Sayfa aralıkları listesine göre böler.
 * @param ranges - [{start, end}] 0-indexed
 */
export async function splitPdfByRanges(sourceBuffer: Buffer, ranges: Array<{ start: number; end: number }>): Promise<SplitResult[]> {
  const sourcePdf = await PDFDocument.load(sourceBuffer);
  const results: SplitResult[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const newDoc = await PDFDocument.create();
    const idxs: number[] = [];
    for (let p = start; p <= end; p++) idxs.push(p);
    const copied = await newDoc.copyPages(sourcePdf, idxs);
    copied.forEach((page) => newDoc.addPage(page));
    const bytes = await newDoc.save();
    results.push({ index: i, pageStart: start, pageEnd: end, buffer: Buffer.from(bytes) });
  }
  return results;
}
