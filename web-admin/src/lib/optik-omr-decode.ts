import type { OmrScanLayout } from '@/lib/optik-api';
import { OMR_PAGE_HEIGHT, OMR_PAGE_WIDTH } from './optik-omr-layout-constants';
import {
  detectOmrQuadOpenCv,
  preloadOptikOpenCv,
  warpOmrOpenCv,
  type OmrQuad as CvOmrQuad,
} from './optik-omr-opencv';

export { preloadOptikOpenCv };

export type OmrDecodeResult = {
  answers: Record<number, string>;
  perQuestion: Array<{ question: number; label: string; fill: number; ambiguous: boolean }>;
  confidence: number;
  needs_rescan: boolean;
  anchor_score?: number;
  /** opencv | legacy | none */
  warp_engine?: 'opencv' | 'legacy' | 'none';
};

export type OmrDecodeMode = 'student' | 'key';

export type OmrDecodeOptions = {
  /** Oturum/şablon soru üst sınırı */
  maxQuestion?: number;
  mode?: OmrDecodeMode;
};

const OMR_DECODE_WIDTH = 1100;
const OMR_DECODE_HEIGHT = Math.round(OMR_DECODE_WIDTH * (OMR_PAGE_HEIGHT / OMR_PAGE_WIDTH));

type Point = { x: number; y: number };

function toGray(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
  }
  return g;
}

/** Kontrast: alt/üst yüzdelik → tam dinamik aralık */
function stretchContrast(gray: Uint8Array): Uint8Array {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!]!++;
  const n = gray.length;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let t = 0; t < 256; t++) {
    acc += hist[t]!;
    if (acc >= n * 0.03) {
      lo = t;
      break;
    }
  }
  acc = 0;
  for (let t = 255; t >= 0; t--) {
    acc += hist[t]!;
    if (acc >= n * 0.03) {
      hi = t;
      break;
    }
  }
  if (hi <= lo + 8) return gray;
  const out = new Uint8Array(n);
  const span = hi - lo;
  for (let i = 0; i < n; i++) {
    const v = gray[i]!;
    out[i] = Math.max(0, Math.min(255, Math.round(((v - lo) / span) * 255)));
  }
  return out;
}

function boxBlur3(gray: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          s += gray[ny * w + nx]!;
          c++;
        }
      }
      out[y * w + x] = c > 0 ? Math.round(s / c) : gray[y * w + x]!;
    }
  }
  return out;
}

/** İç disk vs dış halka — baskı/gürültüye göre göreli işaret gücü (0–1) */
function sampleBubbleMark(
  gray: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rPx: number,
): number {
  const innerR = rPx * 0.4;
  const innerR2 = innerR * innerR;
  const ringR1 = rPx * 0.62;
  const ringR2 = rPx * 1.08;
  const ringR1_2 = ringR1 * ringR1;
  const ringR2_2 = ringR2 * ringR2;
  let innerDark = 0;
  let innerN = 0;
  let ringBright = 0;
  let ringN = 0;
  const step = Math.max(1, Math.floor(rPx / 5));
  for (let dy = -rPx; dy <= rPx; dy += step) {
    for (let dx = -rPx; dx <= rPx; dx += step) {
      const d2 = dx * dx + dy * dy;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const g = gray[y * w + x]!;
      if (d2 <= innerR2) {
        innerDark += 255 - g;
        innerN++;
      } else if (d2 >= ringR1_2 && d2 <= ringR2_2) {
        ringBright += g;
        ringN++;
      }
    }
  }
  if (innerN < 2) return 0;
  const mark = innerDark / innerN / 255;
  const paper = ringN > 0 ? ringBright / ringN / 255 : 0.92;
  return Math.max(0, mark - (1 - paper) * 0.35);
}

function filterLayoutBubbles(layout: OmrScanLayout, opts?: OmrDecodeOptions) {
  const maxQ = opts?.maxQuestion ?? layout.question_count;
  const region = layout.answers_region;
  return layout.bubbles.filter((b) => {
    if (b.question > maxQ) return false;
    if (region && (b.y < region.y_min || b.y > region.y_max)) return false;
    return true;
  });
}

export type BubbleMarkRow = { choice: number; label: string; mark: number };

/** Satır içi normalize + boş/çoklu işaret kuralları */
export function pickAnswerFromMarks(
  opts: BubbleMarkRow[],
  mode: OmrDecodeMode = 'student',
): { label: string; ambiguous: boolean; fill: number } {
  if (opts.length === 0) return { label: '', ambiguous: true, fill: 0 };
  const minM = Math.min(...opts.map((o) => o.mark));
  const maxM = Math.max(...opts.map((o) => o.mark));
  const span = maxM - minM;
  const norm = opts.map((o) => ({
    ...o,
    mark: span > 0.02 ? (o.mark - minM) / span : o.mark,
  }));
  const sorted = [...norm].sort((a, b) => b.mark - a.mark);
  const best = sorted[0]!;
  const second = sorted[1]?.mark ?? 0;
  const margin = best.mark - second;
  const ratio = best.mark / (second + 0.03);

  const blankMin = mode === 'key' ? 0.32 : 0.38;
  const marginMin = mode === 'key' ? 0.14 : 0.2;
  const ratioMin = mode === 'key' ? 1.55 : 1.85;
  const rowMax = maxM;
  const rowQuiet = rowMax < (mode === 'key' ? 0.12 : 0.15);

  const doubleMark =
    second >= blankMin * 0.82 && margin < marginMin * 1.35 && ratio < ratioMin * 1.1;

  const ambiguous =
    rowQuiet ||
    best.mark < blankMin ||
    margin < marginMin ||
    ratio < ratioMin ||
    doubleMark;

  return {
    label: ambiguous ? '' : best.label,
    ambiguous,
    fill: best.mark,
  };
}

/** Yerel köşe — ROI içi yerel eşik + en koyu bağlı alan */
function detectCorner(
  gray: Uint8Array,
  w: number,
  h: number,
  expX: number,
  expY: number,
): Point | null {
  const searchR = Math.round(Math.min(w, h) * 0.11);
  const ecx = Math.round(expX * w);
  const ecy = Math.round(expY * h);
  const x0 = Math.max(0, ecx - searchR);
  const y0 = Math.max(0, ecy - searchR);
  const x1 = Math.min(w - 1, ecx + searchR);
  const y1 = Math.min(h - 1, ecy + searchR);

  const patch: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) patch.push(gray[y * w + x]!);
  }
  patch.sort((a, b) => a - b);
  const thresh = patch[Math.floor(patch.length * 0.72)] ?? 140;

  let best = 0;
  let bx = ecx;
  let by = ecy;
  const step = Math.max(2, Math.floor(searchR / 16));
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      let dark = 0;
      let total = 0;
      const r = 6;
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
          total++;
          if (gray[ny * w + nx]! < thresh) dark++;
        }
      }
      const score = total > 0 ? dark / total : 0;
      const dist = Math.hypot(x - ecx, y - ecy);
      const weighted = score / (1 + dist * 0.002);
      if (weighted > best) {
        best = weighted;
        bx = x;
        by = y;
      }
    }
  }
  return best > 0.32 ? { x: bx, y: by } : null;
}

function bilinearSample(gray: Uint8Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = gray[y0 * w + x0]!;
  const v10 = gray[y0 * w + x1]!;
  const v01 = gray[y1 * w + x0]!;
  const v11 = gray[y1 * w + x1]!;
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

function warpQuadToRect(
  gray: Uint8Array,
  sw: number,
  sh: number,
  tl: Point,
  tr: Point,
  br: Point,
  bl: Point,
  dw: number,
  dh: number,
): Uint8Array {
  const out = new Uint8Array(dw * dh);
  for (let j = 0; j < dh; j++) {
    const v = j / (dh - 1 || 1);
    for (let i = 0; i < dw; i++) {
      const u = i / (dw - 1 || 1);
      const topX = tl.x * (1 - u) + tr.x * u;
      const topY = tl.y * (1 - u) + tr.y * u;
      const botX = bl.x * (1 - u) + br.x * u;
      const botY = bl.y * (1 - u) + br.y * u;
      const sx = topX * (1 - v) + botX * v;
      const sy = topY * (1 - v) + botY * v;
      if (sx >= 0 && sy >= 0 && sx < sw - 1 && sy < sh - 1) {
        out[j * dw + i] = Math.round(bilinearSample(gray, sw, sh, sx, sy));
      } else {
        out[j * dw + i] = 255;
      }
    }
  }
  return out;
}

function prepareGrayFromImage(img: HTMLImageElement): { gray: Uint8Array; w: number; h: number } {
  const scale = Math.min(1, OMR_DECODE_WIDTH / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  return { gray: toGray(id.data, w, h), w, h };
}

export type OmrQuad = { tl: Point; tr: Point; bl: Point; br: Point };

export function detectOmrQuad(
  gray: Uint8Array,
  w: number,
  h: number,
  layout: OmrScanLayout,
): OmrQuad | null {
  const anchors = layout.anchors ?? [];
  if (anchors.length < 4) return null;
  const corners = anchors.slice(0, 4).map((a) => detectCorner(gray, w, h, a.x, a.y));
  const [tl, tr, bl, br] = corners;
  if (!tl || !tr || !bl || !br) return null;
  return { tl, tr, bl, br };
}

export type OmrBubbleSample = {
  question: number;
  choice: number;
  label: string;
  nx: number;
  ny: number;
  r: number;
  mark: number;
};

export type OmrLivePreview = {
  result: OmrDecodeResult;
  quad: OmrQuad | null;
  bubbles: OmrBubbleSample[];
  anchorScore: number;
};

type WarpLayoutResult = {
  gray: Uint8Array;
  w: number;
  h: number;
  anchorScore: number;
  quad: OmrQuad | null;
  engine: 'opencv' | 'legacy' | 'none';
};

function cvQuadToLocal(q: CvOmrQuad): OmrQuad {
  return { tl: q.tl, tr: q.tr, bl: q.bl, br: q.br };
}

const LIVE_PREVIEW_WIDTH = 520;
const LIVE_PREVIEW_HEIGHT = Math.round(LIVE_PREVIEW_WIDTH * (OMR_PAGE_HEIGHT / OMR_PAGE_WIDTH));

/** Canlı kamera — OpenCV yok (ana iş parçacığını kilitlemez) */
function warpForLayoutLive(
  gray: Uint8Array,
  w: number,
  h: number,
  layout: OmrScanLayout,
): WarpLayoutResult {
  const quad = detectOmrQuad(gray, w, h, layout);
  if (!quad) {
    const enhanced = boxBlur3(stretchContrast(gray), w, h);
    return { gray: enhanced, w, h, anchorScore: 0, quad: null, engine: 'none' };
  }
  const warped = warpQuadToRect(
    gray,
    w,
    h,
    quad.tl,
    quad.tr,
    quad.br,
    quad.bl,
    LIVE_PREVIEW_WIDTH,
    LIVE_PREVIEW_HEIGHT,
  );
  const enhanced = boxBlur3(stretchContrast(warped), LIVE_PREVIEW_WIDTH, LIVE_PREVIEW_HEIGHT);
  return {
    gray: enhanced,
    w: LIVE_PREVIEW_WIDTH,
    h: LIVE_PREVIEW_HEIGHT,
    anchorScore: 1,
    quad,
    engine: 'legacy',
  };
}

async function warpForLayout(
  gray: Uint8Array,
  w: number,
  h: number,
  layout: OmrScanLayout,
): Promise<WarpLayoutResult> {
  const cvDet = await detectOmrQuadOpenCv(gray, w, h, layout);
  if (cvDet) {
    const warped = await warpOmrOpenCv(gray, w, h, cvDet.quad, OMR_DECODE_WIDTH, OMR_DECODE_HEIGHT);
    if (warped) {
      return {
        gray: warped,
        w: OMR_DECODE_WIDTH,
        h: OMR_DECODE_HEIGHT,
        anchorScore: Math.min(1, cvDet.score),
        quad: cvQuadToLocal(cvDet.quad),
        engine: 'opencv',
      };
    }
  }

  const quad = detectOmrQuad(gray, w, h, layout);
  if (!quad) {
    const enhanced = boxBlur3(stretchContrast(gray), w, h);
    return { gray: enhanced, w, h, anchorScore: 0, quad: null, engine: 'none' };
  }
  const warped = warpQuadToRect(gray, w, h, quad.tl, quad.tr, quad.br, quad.bl, OMR_DECODE_WIDTH, OMR_DECODE_HEIGHT);
  const enhanced = boxBlur3(stretchContrast(warped), OMR_DECODE_WIDTH, OMR_DECODE_HEIGHT);
  return {
    gray: enhanced,
    w: OMR_DECODE_WIDTH,
    h: OMR_DECODE_HEIGHT,
    anchorScore: 1,
    quad,
    engine: 'legacy',
  };
}

function collectBubbleSamples(
  gray: Uint8Array,
  width: number,
  height: number,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): OmrBubbleSample[] {
  const bubbles = filterLayoutBubbles(layout, opts);
  return bubbles.map((b) => {
    const cx = b.x * width;
    const cy = b.y * height;
    const rPx = Math.max(5, b.r * width * 1.2);
    return {
      question: b.question,
      choice: b.choice,
      label: b.label,
      nx: b.x,
      ny: b.y,
      r: b.r,
      mark: sampleBubbleMark(gray, width, height, cx, cy, rPx),
    };
  });
}

function prepareGrayFromVideo(video: HTMLVideoElement, maxWidth = 720): { gray: Uint8Array; w: number; h: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(1, maxWidth / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  return { gray: toGray(id.data, w, h), w, h };
}

/** Kamera canlı önizleme — senkron, düşük çözünürlük, OpenCV kullanmaz */
export function decodeOmrLivePreviewFromVideo(
  video: HTMLVideoElement,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): OmrLivePreview | null {
  if (!video.videoWidth) return null;
  const { gray, w, h } = prepareGrayFromVideo(video, 400);
  const warped = warpForLayoutLive(gray, w, h, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout, opts);
  const bubbles = collectBubbleSamples(warped.gray, warped.w, warped.h, layout, opts);
  return {
    result: { ...result, anchor_score: warped.anchorScore, warp_engine: warped.engine },
    quad: warped.quad,
    bubbles,
    anchorScore: warped.anchorScore,
  };
}

export function decodeOmrFromGray(
  gray: Uint8Array,
  width: number,
  height: number,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): OmrDecodeResult {
  const mode = opts?.mode ?? 'student';
  const bubbles = filterLayoutBubbles(layout, opts);
  const byQ = new Map<number, BubbleMarkRow[]>();

  const rawMarks: BubbleMarkRow[] = [];
  for (const b of bubbles) {
    const cx = b.x * width;
    const cy = b.y * height;
    const rPx = Math.max(5, b.r * width * 1.2);
    const mark = sampleBubbleMark(gray, width, height, cx, cy, rPx);
    rawMarks.push({ choice: b.choice, label: b.label, mark });
    if (!byQ.has(b.question)) byQ.set(b.question, []);
    byQ.get(b.question)!.push({ choice: b.choice, label: b.label, mark });
  }

  if (rawMarks.length > 8) {
    const sorted = [...rawMarks.map((m) => m.mark)].sort((a, b) => a - b);
    const noise = sorted[Math.floor(sorted.length * 0.35)] ?? 0;
    for (const rows of byQ.values()) {
      for (const row of rows) {
        row.mark = Math.max(0, row.mark - noise * 0.85);
      }
    }
  }

  const maxQ = opts?.maxQuestion ?? layout.question_count;
  const questionIds = [...byQ.keys()].filter((q) => q >= 1 && q <= maxQ).sort((a, b) => a - b);

  const answers: Record<number, string> = {};
  const perQuestion: OmrDecodeResult['perQuestion'] = [];
  let sumConf = 0;
  let ambiguousCount = 0;
  let answered = 0;

  for (const q of questionIds) {
    const optsRow = byQ.get(q) ?? [];
    const picked = pickAnswerFromMarks(optsRow, mode);
    if (!picked.ambiguous && picked.label) {
      answers[q] = picked.label;
      answered += 1;
      sumConf += picked.fill;
    }
    perQuestion.push({
      question: q,
      label: picked.label,
      fill: picked.fill,
      ambiguous: picked.ambiguous,
    });
    if (picked.ambiguous) ambiguousCount += 1;
  }

  const n = perQuestion.length || 1;
  const confidence = answered > 0 ? Math.round((sumConf / answered) * 100) / 100 : 0;
  const expectedFill = mode === 'key' ? maxQ * 0.5 : maxQ * 0.35;
  const needs_rescan =
    ambiguousCount > Math.max(3, Math.floor(n * 0.15)) ||
    (answered < expectedFill && ambiguousCount > Math.floor(n * 0.08));

  return {
    answers,
    perQuestion,
    confidence,
    needs_rescan,
  };
}

export async function decodeOmrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<OmrDecodeResult> {
  const gray = toGray(data, width, height);
  const warped = await warpForLayout(gray, width, height, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout, opts);
  return { ...result, anchor_score: warped.anchorScore, warp_engine: warped.engine };
}

function loadImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görüntü yüklenemedi'));
    img.src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  });
}

export async function decodeOmrFromBase64(
  b64: string,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<OmrDecodeResult> {
  const img = await loadImage(b64);
  const { gray, w, h } = prepareGrayFromImage(img);
  const warped = await warpForLayout(gray, w, h, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout, opts);
  return { ...result, anchor_score: warped.anchorScore, warp_engine: warped.engine };
}

function scoreOmrFrame(r: OmrDecodeResult): number {
  const n = r.perQuestion.length || 1;
  const amb = r.perQuestion.filter((p) => p.ambiguous).length / n;
  const anchor = r.anchor_score ?? 0;
  const engineBonus = r.warp_engine === 'opencv' ? 0.12 : r.warp_engine === 'legacy' ? 0.05 : 0;
  return anchor * 0.45 + r.confidence * 0.35 + engineBonus - amb * 0.35;
}

/** Çoklu kare: en iyi kare + çoğunluk oyu birleşimi */
export async function decodeOmrBurstEnhanced(
  frames: string[],
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<{ result: OmrDecodeResult; previewFrame: string; bestIndex: number }> {
  if (frames.length === 0) {
    return {
      result: { answers: {}, perQuestion: [], confidence: 0, needs_rescan: true },
      previewFrame: '',
      bestIndex: 0,
    };
  }
  if (frames.length === 1) {
    const result = await decodeOmrFromBase64(frames[0]!, layout, opts);
    return { result, previewFrame: frames[0]!, bestIndex: 0 };
  }

  const decoded = await Promise.all(frames.map((f) => decodeOmrFromBase64(f, layout, opts)));
  const ranked = decoded
    .map((r, idx) => ({ idx, r, score: scoreOmrFrame(r) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]!;
  const merged = mergeOmrResults(decoded);

  for (const p of merged.perQuestion) {
    if (!p.ambiguous) continue;
    const bp = best.r.perQuestion.find((x) => x.question === p.question);
    if (bp && !bp.ambiguous && bp.label) {
      merged.answers[p.question] = bp.label;
      p.label = bp.label;
      p.ambiguous = false;
      p.fill = bp.fill;
    }
  }

  const ambiguousCount = merged.perQuestion.filter((p) => p.ambiguous).length;
  const n = merged.perQuestion.length || 1;
  merged.anchor_score = best.r.anchor_score;
  merged.warp_engine = best.r.warp_engine;
  merged.confidence = Math.round(((merged.confidence + best.r.confidence) / 2) * 100) / 100;
  merged.needs_rescan =
    ambiguousCount > Math.max(3, Math.floor(n * 0.12)) ||
    (best.r.needs_rescan && ambiguousCount > 0);

  return { result: merged, previewFrame: frames[best.idx]!, bestIndex: best.idx };
}

export async function decodeOmrBurst(
  frames: string[],
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<OmrDecodeResult> {
  const { result } = await decodeOmrBurstEnhanced(frames, layout, opts);
  return result;
}

/** Ön izleme overlay (statik JPEG) */
export async function decodeOmrPreviewFromBase64(
  b64: string,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<OmrLivePreview | null> {
  const img = await loadImage(b64);
  const scale = Math.min(1, 720 / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const gray = toGray(id.data, w, h);
  const warped = await warpForLayout(gray, w, h, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout, opts);
  const bubbles = collectBubbleSamples(warped.gray, warped.w, warped.h, layout, opts);
  return {
    result: { ...result, anchor_score: warped.anchorScore, warp_engine: warped.engine },
    quad: warped.quad,
    bubbles,
    anchorScore: warped.anchorScore,
  };
}

export function mergeOmrResults(results: OmrDecodeResult[]): OmrDecodeResult {
  if (results.length === 0) {
    return { answers: {}, perQuestion: [], confidence: 0, needs_rescan: true };
  }
  if (results.length === 1) return results[0]!;

  const voteMap = new Map<number, Map<string, number>>();
  for (const r of results) {
    for (const [q, lbl] of Object.entries(r.answers)) {
      const n = Number(q);
      if (!voteMap.has(n)) voteMap.set(n, new Map());
      const m = voteMap.get(n)!;
      m.set(lbl, (m.get(lbl) ?? 0) + 1);
    }
  }

  const answers: Record<number, string> = {};
  let ambiguousCount = 0;
  const perQuestion: OmrDecodeResult['perQuestion'] = [];
  const allQ = new Set<number>();
  for (const r of results) {
    for (const p of r.perQuestion) allQ.add(p.question);
  }

  for (const q of [...allQ].sort((a, b) => a - b)) {
    const votes = voteMap.get(q);
    if (!votes || votes.size === 0) {
      ambiguousCount += 1;
      perQuestion.push({ question: q, label: '', fill: 0, ambiguous: true });
      continue;
    }
    const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const [lbl, cnt] = sorted[0]!;
    const total = [...votes.values()].reduce((s, v) => s + v, 0);
    const ambiguous = cnt < 2 && results.length >= 2 && total < results.length * 0.65;
    if (!ambiguous) answers[q] = lbl;
    else ambiguousCount += 1;
    perQuestion.push({
      question: q,
      label: ambiguous ? '' : lbl,
      fill: cnt / total,
      ambiguous,
    });
  }

  const n = perQuestion.length || 1;
  const confs = results.map((r) => r.confidence).filter((c) => c > 0);
  const confidence =
    confs.length > 0 ? Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 100) / 100 : 0;
  const needs_rescan =
    ambiguousCount > Math.max(3, Math.floor(n * 0.12)) ||
    (results.some((r) => r.needs_rescan) && ambiguousCount > 0);

  return { answers, perQuestion, confidence, needs_rescan };
}

export function captureVideoFrameJpeg(video: HTMLVideoElement, quality = 0.88): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.split(',')[1] ?? dataUrl;
}

export async function decodeOmrFromVideoFrame(
  video: HTMLVideoElement,
  layout: OmrScanLayout,
  opts?: OmrDecodeOptions,
): Promise<OmrDecodeResult> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  return decodeOmrFromImageData(img.data, w, h, layout, opts);
}
