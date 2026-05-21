import type { OmrBubbleSample, OmrQuad } from './optik-omr-decode';

export type BubbleOverlayKind = 'empty' | 'marked' | 'correct' | 'wrong' | 'ambiguous' | 'key';

export type OmrOverlayStats = { dogru: number; yanlis: number; bos: number };

export function answerKeyToNumberMap(key: Record<string, string> | Record<number, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(key)) {
    const q = Number(k);
    if (q >= 1 && v) out[q] = v.toUpperCase();
  }
  return out;
}

export function resolveBubbleOverlayKind(
  label: string,
  mark: number,
  studentAnswer: string | undefined,
  keyAnswer: string | undefined,
  rowAmbiguous: boolean,
): BubbleOverlayKind {
  const strong = mark >= 0.22;
  const picked = studentAnswer === label;
  const isKey = keyAnswer === label;

  if (keyAnswer) {
    if (picked && isKey) return 'correct';
    if (picked && !isKey) return 'wrong';
    if (!picked && isKey && !studentAnswer) return 'key';
    if (!picked && isKey && studentAnswer) return 'key';
    if (strong && rowAmbiguous) return 'ambiguous';
    return 'empty';
  }

  if (picked || (strong && !rowAmbiguous)) return 'marked';
  if (strong && rowAmbiguous) return 'ambiguous';
  return 'empty';
}

export function computeOverlayStats(
  answers: Record<number, string>,
  answerKey: Record<number, string>,
  maxQuestion: number,
): OmrOverlayStats {
  let dogru = 0;
  let yanlis = 0;
  let bos = 0;
  for (let q = 1; q <= maxQuestion; q++) {
    const key = answerKey[q];
    if (!key) continue;
    const st = answers[q];
    if (!st) {
      bos += 1;
      continue;
    }
    if (st === key) dogru += 1;
    else yanlis += 1;
  }
  return { dogru, yanlis, bos };
}

/** object-cover video → konteyner piksel */
export function videoObjectCoverRect(
  videoW: number,
  videoH: number,
  containerW: number,
  containerH: number,
): { scale: number; offsetX: number; offsetY: number; dispW: number; dispH: number } {
  const scale = Math.max(containerW / videoW, containerH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  return {
    scale,
    offsetX: (containerW - dispW) / 2,
    offsetY: (containerH - dispH) / 2,
    dispW,
    dispH,
  };
}

/** A4 normalize (0–1) → kaynak video pikseli */
export function a4NormToVideoPixel(
  nx: number,
  ny: number,
  quad: OmrQuad,
  videoW: number,
  videoH: number,
): { x: number; y: number } {
  const topX = quad.tl.x * (1 - nx) + quad.tr.x * nx;
  const topY = quad.tl.y * (1 - nx) + quad.tr.y * nx;
  const botX = quad.bl.x * (1 - nx) + quad.br.x * nx;
  const botY = quad.bl.y * (1 - nx) + quad.br.y * nx;
  return {
    x: topX * (1 - ny) + botX * ny,
    y: topY * (1 - ny) + botY * ny,
  };
}

/** Kaynak video pikseli → konteyner CSS pikseli */
export function videoPixelToContainer(
  sx: number,
  sy: number,
  videoW: number,
  videoH: number,
  containerW: number,
  containerH: number,
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = videoObjectCoverRect(videoW, videoH, containerW, containerH);
  return { x: offsetX + sx * scale, y: offsetY + sy * scale };
}

export function mapBubbleToContainer(
  b: OmrBubbleSample,
  quad: OmrQuad | null,
  videoW: number,
  videoH: number,
  containerW: number,
  containerH: number,
): { x: number; y: number; radius: number } {
  const inset = 0.07;
  let sx: number;
  let sy: number;
  if (quad) {
    const p = a4NormToVideoPixel(b.nx, b.ny, quad, videoW, videoH);
    sx = p.x;
    sy = p.y;
  } else {
    sx = videoW * (inset + b.nx * (1 - 2 * inset));
    sy = videoH * (inset + b.ny * (1 - 2 * inset));
  }
  const c = videoPixelToContainer(sx, sy, videoW, videoH, containerW, containerH);
  const { scale } = videoObjectCoverRect(videoW, videoH, containerW, containerH);
  const radius = Math.max(6, b.r * Math.min(containerW, containerH) * scale * 2.8);
  return { x: c.x, y: c.y, radius };
}

export const OVERLAY_COLORS: Record<BubbleOverlayKind, { fill: string; stroke: string }> = {
  empty: { fill: 'transparent', stroke: 'transparent' },
  marked: { fill: 'rgba(56, 189, 248, 0.55)', stroke: 'rgba(14, 165, 233, 0.95)' },
  correct: { fill: 'rgba(34, 197, 94, 0.72)', stroke: 'rgba(22, 163, 74, 1)' },
  wrong: { fill: 'rgba(239, 68, 68, 0.78)', stroke: 'rgba(220, 38, 38, 1)' },
  ambiguous: { fill: 'rgba(234, 179, 8, 0.55)', stroke: 'rgba(202, 138, 4, 0.95)' },
  key: { fill: 'rgba(34, 197, 94, 0.22)', stroke: 'rgba(34, 197, 94, 0.65)' },
};
