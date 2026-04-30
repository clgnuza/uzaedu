/**
 * e-Okul öğretmen ders programı PDF: düz metin sırası güvenilir değil (birleşik hücre, boş sütun).
 * pdf.js ile (x,y) konumlarından Pzt–Cu sütunlarına atar.
 */

import * as path from 'path';
import { pathToFileURL } from 'url';

export interface EokulLayoutLessonRow {
  lessonNum: number;
  cells: string[];
}

export interface EokulLayoutTeacherPage {
  teacherNameRaw: string;
  lessons: EokulLayoutLessonRow[];
}

type TextSpan = { str: string; x: number; y: number; pageYTop: number };

const LESSON_RE = /(\d{1,2})\.\s*DERS/i;
const TIME_RE = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;
/** Satır başı saat (aynı satırda hücre metni de olabilir) — bir sonraki ders diliminin başlangıcı */
const TIME_ROW_PREFIX_RE = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/;

function spanScreenTop(pageHeight: number, pdfY: number): number {
  return pageHeight - pdfY;
}

/** Aynı görsel satır: PDF'de üstten alta okuma sırası (pageYTop küçük = üst) */
function clusterSpansToLines(spans: TextSpan[], yTol = 4): TextSpan[][] {
  const sorted = [...spans].sort((a, b) => a.pageYTop - b.pageYTop);
  const lines: TextSpan[][] = [];
  for (const s of sorted) {
    const row = lines.find((line) => Math.abs(line[0]!.pageYTop - s.pageYTop) <= yTol);
    if (row) row.push(s);
    else lines.push([s]);
  }
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
  }
  return lines;
}

function lineText(line: TextSpan[]): string {
  return line
    .map((s) => s.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLessonNumFromLine(text: string): number | null {
  const m = text.match(LESSON_RE);
  if (!m) return null;
  const n = parseInt(m[1] ?? '', 10);
  return n >= 1 && n <= 12 ? n : null;
}

function extractTeacherName(pageLines: string[]): string {
  for (const t of pageLines) {
    const m = t.match(/^Öğretmen\s+Ad[ıi]\s+Soyad[ıi]\s*:\s*(.+?)(?=\s+Bran[şs]?[ıi]?\s*:|\s+\d{4}-\d{4}|$)/i);
    if (m) {
      return String(m[1] ?? '')
        .replace(/\s+/g, ' ')
        .replace(/\s+\d{4}-\d{4}.*$/i, '')
        .replace(/\s+I{1,3}\.?\s*D[ÖO]NEM.*$/i, '')
        .replace(/\s*Bran[şs]?[ıi]?\s*:.*$/i, '')
        .trim();
    }
  }
  return '';
}

/** pdf.js harfleri ayrı öğe yapabildiği için satır metni yerine tüm sayfa metni */
function extractTeacherNameFromRawPdfText(flat: string): string {
  const m = flat.match(/Öğretmen\s+Ad[ıi]\s+Soyad[ıi]\s*:\s*(.+?)(?=Bran[şs]?[ıi]?\s*:|20\d{2}-\d{4})/i);
  if (!m) return '';
  let name = String(m[1] ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*20\d{2}-\d{4}.*$/i, '')
    .replace(/\s+I{1,3}\.?\s*D[ÖO]NEM.*$/i, '')
    .replace(/\s*Bran[şs]?[ıi]?\s*:.*$/i, '')
    .trim();
  name = name.replace(/\s*20\d{2}.*$/i, '').trim();
  return name;
}

/**
 * Tablo x aralığı: sol zaman sütununu kırp; çoğu ders hücresi '<->' içerir.
 */
function tableXBounds(spans: TextSpan[]): { xmin: number; xmax: number } | null {
  const arrowXs = spans.filter((s) => s.str.includes('<->')).map((s) => s.x);
  if (arrowXs.length >= 3) {
    arrowXs.sort((a, b) => a - b);
    const i0 = Math.floor(arrowXs.length * 0.05);
    const i1 = Math.ceil(arrowXs.length * 0.95) - 1;
    return { xmin: arrowXs[i0]!, xmax: arrowXs[Math.max(i0, i1)]! };
  }
  const xs = spans.map((s) => s.x).filter((x) => Number.isFinite(x));
  if (xs.length < 5) return null;
  xs.sort((a, b) => a - b);
  const q = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * (xs.length - 1)))]!;
  return { xmin: q(0.15), xmax: q(0.98) };
}

/** Saat dilimi satırından sol üstte kalan saat parçalarını at (zaman sütunu); ders adı <-> solunda kalabilir — x ile kesme yapılmaz */
function filterSpansSchedulingCells(sliceSpans: TextSpan[]): TextSpan[] {
  return sliceSpans.filter((s) => {
    const t = s.str.replace(/\s+/g, '').trim();
    if (/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(t)) return false;
    if (/^\d{1,2}$/.test(t) && t.length <= 2) return false;
    return true;
  });
}

/** Bir ders dilimindeki satırlardan Pzt–Cu sütun ara sınırları (4 adet x) */
function inferBoundariesFromSliceLines(sliceLines: TextSpan[][]): number[] | null {
  let best: TextSpan[] | null = null;
  let bestArrows = 0;
  for (const line of sliceLines) {
    const n = line.filter((s) => s.str.includes('<->')).length;
    if (n > bestArrows) {
      bestArrows = n;
      best = line;
    }
  }
  if (!best || bestArrows < 5) return null;
  const xs = best
    .filter((s) => s.str.includes('<->'))
    .map((s) => s.x)
    .sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(last[last.length - 1]! - x) > 22) clusters.push([x]);
    else last.push(x);
  }
  if (clusters.length < 5) return null;
  const centers = clusters.slice(0, 5).map((c) => c.reduce((a, b) => a + b, 0) / c.length);
  const boundaries: number[] = [];
  for (let i = 0; i < 4; i++) {
    boundaries.push((centers[i]! + centers[i + 1]!) / 2);
  }
  return boundaries;
}

function kmeans1DColumnBoundaries(xs: number[], k = 5): number[] | null {
  const arr = xs.filter((x) => Number.isFinite(x));
  if (arr.length < k) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max - min < 20) return null;
  const cent: number[] = Array.from({ length: k }, (_, i) => min + ((i + 0.5) / k) * (max - min));
  for (let it = 0; it < 12; it++) {
    const groups: number[][] = Array.from({ length: k }, () => []);
    for (const x of arr) {
      let bi = 0;
      let bd = Infinity;
      for (let j = 0; j < k; j++) {
        const d = Math.abs(x - cent[j]!);
        if (d < bd) {
          bd = d;
          bi = j;
        }
      }
      groups[bi]!.push(x);
    }
    for (let j = 0; j < k; j++) {
      const g = groups[j]!;
      if (g.length) cent[j] = g.reduce((a, b) => a + b, 0) / g.length;
    }
  }
  const sortedC = [...cent].sort((a, b) => a - b);
  const b: number[] = [];
  for (let i = 0; i < k - 1; i++) {
    b.push((sortedC[i]! + sortedC[i + 1]!) / 2);
  }
  return b;
}

function assignToFiveColumnsAdaptive(
  spans: TextSpan[],
  sliceLines: TextSpan[][],
  xmin: number,
  xmax: number,
): string[] {
  const inferred = inferBoundariesFromSliceLines(sliceLines);
  const arrowXs = spans.filter((s) => s.str.includes('<->')).map((s) => s.x);
  let boundaries: number[] | null = inferred;

  if (!boundaries) {
    boundaries = kmeans1DColumnBoundaries(arrowXs, 5);
  }

  if (!boundaries && arrowXs.length >= 5) {
    const sorted = [...arrowXs].sort((a, b) => a - b);
    const picks: number[] = [];
    for (let k = 0; k < 5; k++) {
      const idx = Math.min(sorted.length - 1, Math.floor(((k + 0.5) / 5) * sorted.length));
      picks.push(sorted[idx]!);
    }
    boundaries = [];
    for (let i = 0; i < 4; i++) {
      boundaries.push((picks[i]! + picks[i + 1]!) / 2);
    }
  }

  const colOf = (x: number): number => {
    if (boundaries && boundaries.length === 4) {
      let c = 0;
      for (const t of boundaries) {
        if (x > t) c++;
        else break;
      }
      return Math.min(4, c);
    }
    const w = xmax - xmin;
    if (w <= 10) return 0;
    return Math.min(4, Math.max(0, Math.floor(((x - xmin) / w) * 5)));
  };

  const buckets: TextSpan[][] = [[], [], [], [], []];
  for (const s of spans) {
    buckets[colOf(s.x)]!.push(s);
  }
  const out: string[] = [];
  for (const b of buckets) {
    b.sort((a, c) => a.pageYTop - c.pageYTop);
    const t = b
      .map((x) => x.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    out.push(t);
  }
  return out;
}

function extractLessonsFromPageSpans(spans: TextSpan[], _pageHeight: number): EokulLayoutLessonRow[] {
  const bounds = tableXBounds(spans);
  if (!bounds) return [];

  const lines = clusterSpansToLines(spans);
  const lineTexts = lines.map(lineText);

  /** N. DERS ile bir sonraki saat satırı arası = o saatin Pzt–Cu hücreleri (e-Okul düzeni). */
  const lessons: EokulLayoutLessonRow[] = [];
  const byLesson = new Map<number, string[]>();

  for (let i = 0; i < lines.length; i++) {
    const t = (lineTexts[i] ?? '').replace(/\s+/g, ' ').trim();
    const ln = parseLessonNumFromLine(t);
    if (ln == null) continue;

    let endIdx = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const t2 = (lineTexts[j] ?? '').replace(/\s+/g, ' ').trim();
      if (TIME_RE.test(t2) || TIME_ROW_PREFIX_RE.test(t2)) {
        endIdx = j;
        break;
      }
      const nextLn = parseLessonNumFromLine(t2);
      if (nextLn === ln + 1) {
        endIdx = j;
        break;
      }
    }

    const sliceLines = lines.slice(i + 1, endIdx);
    let sliceSpans = sliceLines.flat();
    sliceSpans = filterSpansSchedulingCells(sliceSpans);
    const sliceBounds = tableXBounds(sliceSpans) ?? bounds;

    const linesWithArrow = sliceLines.filter((ln) => lineText(ln).includes('<->'));
    let cells: string[];
    if (linesWithArrow.length === 5) {
      cells = linesWithArrow.map((ln) =>
        lineText(ln)
          .replace(/\s+/g, ' ')
          .trim(),
      );
    } else {
      cells = assignToFiveColumnsAdaptive(sliceSpans, sliceLines, sliceBounds.xmin, sliceBounds.xmax);
    }
    byLesson.set(ln, cells);
  }

  for (const [lessonNum, cells] of byLesson) {
    lessons.push({ lessonNum, cells });
  }

  lessons.sort((a, b) => a.lessonNum - b.lessonNum);
  return lessons;
}

export async function extractEokulTeacherScheduleFromPdf(buffer: Buffer): Promise<EokulLayoutTeacherPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument, GlobalWorkerOptions } = pdfjs as typeof import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof GlobalWorkerOptions !== 'undefined') {
    const workerPath = path.join(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
    GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }

  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const out: EokulLayoutTeacherPage[] = [];

  for (let pi = 1; pi <= doc.numPages; pi++) {
    const page = await doc.getPage(pi);
    const vp = page.getViewport({ scale: 1.0 });
    const ph = vp.height;
    const tc = await page.getTextContent();
    const flatRaw = (tc.items as Array<{ str?: string }>).map((i) => String(i.str ?? '')).join('');
    const spans: TextSpan[] = [];
    for (const it of tc.items as Array<{ str?: string; transform?: number[] }>) {
      const str = typeof it.str === 'string' ? it.str : '';
      const tr = it.transform;
      if (!tr || tr.length < 6) continue;
      const x = tr[4]!;
      const pdfY = tr[5]!;
      spans.push({ str, x, y: pdfY, pageYTop: spanScreenTop(ph, pdfY) });
    }

    const pageLines = clusterSpansToLines(spans).map(lineText);
    const teacherNameRaw =
      extractTeacherNameFromRawPdfText(flatRaw) || extractTeacherName(pageLines);
    if (!teacherNameRaw || !pageLines.some((l) => LESSON_RE.test(l))) {
      continue;
    }

    const lessons = extractLessonsFromPageSpans(spans, ph);
    if (lessons.length === 0) continue;

    out.push({ teacherNameRaw, lessons });
  }

  return out;
}
