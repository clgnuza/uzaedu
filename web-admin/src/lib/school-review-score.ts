/** Okul değerlendirme kriter puanı aralığı (örn. 1–10). */
export function inclusiveScoreRange(min: number, max: number): number[] {
  const a = Math.round(min);
  const b = Math.round(max);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** min–max skalasında doluluk oranı (çubuk genişliği için), 0–1. */
export function scoreRatio01(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = hi - lo;
  if (span <= 0 || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - lo) / span));
}
