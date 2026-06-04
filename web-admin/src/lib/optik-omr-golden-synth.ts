import type { OmrScanLayout } from '@/lib/optik-api';
import { OMR_PAGE_HEIGHT, OMR_PAGE_WIDTH } from './optik-omr-layout-constants';

export const GOLDEN_DECODE_WIDTH = 1100;
export const GOLDEN_DECODE_HEIGHT = Math.round(GOLDEN_DECODE_WIDTH * (OMR_PAGE_HEIGHT / OMR_PAGE_WIDTH));

export type GoldenSynthOpts = {
  /** 0–1 gürültü yoğunluğu */
  noise?: number;
  /** İkinci şık (çift işaret) */
  doubleMarks?: Record<number, string>;
  /** H1–H5: digit_index → 0-9 */
  idDigitMarks?: Record<number, number>;
};

function fillDisk(gray: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, v: number) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      gray[y * w + x] = v;
    }
  }
}

function fillAnchor(gray: Uint8Array, w: number, h: number, nx: number, ny: number, sizeNorm: number) {
  const cx = Math.round(nx * w);
  const cy = Math.round(ny * h);
  const half = Math.max(6, Math.round((sizeNorm * w) / 2));
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      gray[y * w + x] = 25;
    }
  }
}

/** omr-v4 layout koordinatlarında hizalı sentetik tarama görüntüsü */
export function synthOmrV4AlignedGray(
  layout: OmrScanLayout,
  marks: Record<number, string>,
  opts?: GoldenSynthOpts,
): { gray: Uint8Array; w: number; h: number } {
  const w = GOLDEN_DECODE_WIDTH;
  const h = GOLDEN_DECODE_HEIGHT;
  const gray = new Uint8Array(w * h);
  gray.fill(252);

  for (const a of layout.anchors) {
    fillAnchor(gray, w, h, a.x, a.y, a.size);
  }

  const doubles = opts?.doubleMarks ?? {};
  const idMarks = opts?.idDigitMarks ?? {};
  for (const b of layout.id_digit_bubbles ?? []) {
    const cx = Math.round(b.x * w);
    const cy = Math.round(b.y * h);
    const r = Math.max(6, Math.round(b.r * w * 1.1));
    const filled = idMarks[b.digit_index] === b.value;
    fillDisk(gray, w, h, cx, cy, r, filled ? 32 : 248);
  }

  for (const b of layout.bubbles) {
    const cx = Math.round(b.x * w);
    const cy = Math.round(b.y * h);
    const r = Math.max(6, Math.round(b.r * w * 1.15));
    const primary = marks[b.question] === b.label;
    const secondary = doubles[b.question] === b.label;
    const filled = primary || secondary;
    fillDisk(gray, w, h, cx, cy, r, filled ? 32 : 248);
  }

  const noise = opts?.noise ?? 0;
  if (noise > 0) {
    for (let i = 0; i < Math.floor(gray.length * noise * 0.02); i++) {
      const p = (i * 7919 + 104729) % gray.length;
      gray[p] = ((i * 17) % 5 === 0 ? 210 : 60) as number;
    }
  }

  return { gray, w, h };
}
