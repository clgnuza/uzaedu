import type { OmrScanLayout } from '@/lib/optik-api';
import { OMR_PAGE_HEIGHT, OMR_PAGE_WIDTH } from './optik-omr-layout-constants';

export type OmrDecodeResult = {
  answers: Record<number, string>;
  perQuestion: Array<{ question: number; label: string; fill: number; ambiguous: boolean }>;
  confidence: number;
  needs_rescan: boolean;
  anchor_score?: number;
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

function paperThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!]!++;
  let acc = 0;
  const target = Math.floor(gray.length * 0.88);
  for (let t = 255; t >= 0; t--) {
    acc += hist[t]!;
    if (acc >= target) return Math.max(100, t - 25);
  }
  return 180;
}

function sampleFillAdaptive(
  gray: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rPx: number,
  thresh: number,
): number {
  const r2 = rPx * rPx;
  let dark = 0;
  let total = 0;
  const innerR = rPx * 0.55;
  const innerR2 = innerR * innerR;
  const step = Math.max(1, Math.floor(rPx / 4));
  for (let dy = -rPx; dy <= rPx; dy += step) {
    for (let dx = -rPx; dx <= rPx; dx += step) {
      if (dx * dx + dy * dy > r2) continue;
      if (dx * dx + dy * dy > innerR2) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (gray[y * w + x]! < thresh) dark += 1;
      total += 1;
    }
  }
  return total > 0 ? dark / total : 0;
}

function detectCorner(
  gray: Uint8Array,
  w: number,
  h: number,
  expX: number,
  expY: number,
): Point | null {
  const searchR = Math.min(w, h) * 0.1;
  const ecx = expX * w;
  const ecy = expY * h;
  let best = 0;
  let bx = ecx;
  let by = ecy;
  const step = Math.max(2, Math.floor(searchR / 20));
  for (let dy = -searchR; dy <= searchR; dy += step) {
    for (let dx = -searchR; dx <= searchR; dx += step) {
      const x = Math.round(ecx + dx);
      const y = Math.round(ecy + dy);
      if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) continue;
      let dark = 0;
      const r = 5;
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (gray[(y + oy) * w + (x + ox)]! < 100) dark++;
        }
      }
      const score = dark / ((2 * r + 1) * (2 * r + 1));
      if (score > best) {
        best = score;
        bx = x;
        by = y;
      }
    }
  }
  return best > 0.28 ? { x: bx, y: by } : null;
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

/** 4 köşe → dikdörtgen warp (hızlı ters haritalama) */
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

function warpForLayout(
  gray: Uint8Array,
  w: number,
  h: number,
  layout: OmrScanLayout,
): { gray: Uint8Array; w: number; h: number; anchorScore: number } {
  const anchors = layout.anchors ?? [];
  if (anchors.length < 4) {
    return { gray, w, h, anchorScore: 0 };
  }
  const detected = anchors
    .map((a) => detectCorner(gray, w, h, a.x, a.y))
    .filter((p): p is Point => p != null);
  if (detected.length < 4) {
    return { gray, w, h, anchorScore: detected.length / 4 };
  }
  const sorted = [...detected].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bot = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  const tl = top[0]!;
  const tr = top[1]!;
  const bl = bot[0]!;
  const br = bot[1]!;
  const warped = warpQuadToRect(gray, w, h, tl, tr, br, bl, OMR_DECODE_WIDTH, OMR_DECODE_HEIGHT);
  return { gray: warped, w: OMR_DECODE_WIDTH, h: OMR_DECODE_HEIGHT, anchorScore: 1 };
}

export function decodeOmrFromGray(
  gray: Uint8Array,
  width: number,
  height: number,
  layout: OmrScanLayout,
): OmrDecodeResult {
  const thresh = paperThreshold(gray);
  const byQ = new Map<number, Array<{ choice: number; label: string; fill: number }>>();

  for (const b of layout.bubbles) {
    const cx = b.x * width;
    const cy = b.y * height;
    const rPx = Math.max(4, b.r * width * 1.15);
    const fill = sampleFillAdaptive(gray, width, height, cx, cy, rPx, thresh);
    if (!byQ.has(b.question)) byQ.set(b.question, []);
    byQ.get(b.question)!.push({ choice: b.choice, label: b.label, fill });
  }

  const answers: Record<number, string> = {};
  const perQuestion: OmrDecodeResult['perQuestion'] = [];
  let sumConf = 0;
  let ambiguousCount = 0;
  let answered = 0;

  for (const [q, opts] of [...byQ.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...opts].sort((a, b) => b.fill - a.fill);
    const best = sorted[0]!;
    const second = sorted[1]?.fill ?? 0;
    const ratio = best.fill / (second + 0.04);
    const ambiguous = best.fill < 0.18 || ratio < 1.35;
    if (!ambiguous) {
      answers[q] = best.label;
      answered += 1;
      sumConf += Math.min(1, (ratio - 1) * 0.35 + best.fill * 0.5);
    }
    perQuestion.push({
      question: q,
      label: ambiguous ? '' : best.label,
      fill: best.fill,
      ambiguous,
    });
    if (ambiguous) ambiguousCount += 1;
  }

  const n = perQuestion.length || 1;
  const confidence = answered > 0 ? Math.round((sumConf / answered) * 100) / 100 : 0;
  const needs_rescan =
    ambiguousCount > Math.max(2, Math.floor(n * 0.12)) || answered < n * 0.85;

  return {
    answers,
    perQuestion,
    confidence,
    needs_rescan,
  };
}

export function decodeOmrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  layout: OmrScanLayout,
): OmrDecodeResult {
  const gray = toGray(data, width, height);
  const warped = warpForLayout(gray, width, height, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout);
  return { ...result, anchor_score: warped.anchorScore };
}

function loadImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görüntü yüklenemedi'));
    img.src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  });
}

export async function decodeOmrFromBase64(b64: string, layout: OmrScanLayout): Promise<OmrDecodeResult> {
  const img = await loadImage(b64);
  const { gray, w, h } = prepareGrayFromImage(img);
  const warped = warpForLayout(gray, w, h, layout);
  const result = decodeOmrFromGray(warped.gray, warped.w, warped.h, layout);
  return { ...result, anchor_score: warped.anchorScore };
}

/** Ardışık kareler — çoğunluk oyu (doğruluk) */
export async function decodeOmrBurst(
  frames: string[],
  layout: OmrScanLayout,
): Promise<OmrDecodeResult> {
  const decoded = await Promise.all(frames.map((f) => decodeOmrFromBase64(f, layout)));
  return mergeOmrResults(decoded);
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
    const ambiguous = cnt < 2 && results.length >= 2 && total < results.length * 0.6;
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
    ambiguousCount > Math.max(2, Math.floor(n * 0.1)) ||
    results.some((r) => r.needs_rescan) && ambiguousCount > 0;

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

export function decodeOmrFromVideoFrame(video: HTMLVideoElement, layout: OmrScanLayout): OmrDecodeResult {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  return decodeOmrFromImageData(img.data, w, h, layout);
}
