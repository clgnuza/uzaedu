export type ReviewPlacementScoreRow = {
  year: number;
  /** Merkezî yerleştirme (LGS puanı) taban / son yerleşen göstergesi — API alanı adı eski uyumluluk için. */
  with_exam: number | null;
  /** Yerel yerleştirme göstergesi (OBP/son yerleşen vb.; okul politikasına göre) — API alanı adı eski uyumluluk için. */
  without_exam: number | null;
};

/** Ortaöğretime geçiş yerleştirme satırı; en fazla 4 yıl, yıla göre tek satır (normalize edilir). */
export function normalizeReviewPlacementScoresJson(raw: unknown): ReviewPlacementScoreRow[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const rows: ReviewPlacementScoreRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const y = typeof o.year === 'number' ? o.year : parseInt(String(o.year ?? ''), 10);
    if (!Number.isFinite(y) || y < 1990 || y > 2100) continue;
    const parseNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 100) / 100;
    };
    rows.push({
      year: y,
      with_exam: parseNum(o.with_exam),
      without_exam: parseNum(o.without_exam),
    });
  }
  const byYear = new Map<number, ReviewPlacementScoreRow>();
  for (const r of rows) {
    byYear.set(r.year, r);
  }
  const sorted = [...byYear.values()].sort((a, b) => b.year - a.year).slice(0, 4);
  return sorted.length ? sorted : null;
}
