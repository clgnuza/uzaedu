/** Haftalık ders dağılımı: 2+2, 2+1+1, 3+1, 4 … (gün başına saat sayıları) */

export const DAY_DISTRIBUTION_PRESETS: Record<number, number[][]> = {
  1: [[1]],
  2: [[2], [1, 1]],
  3: [[3], [2, 1], [1, 1, 1]],
  4: [[4], [2, 2], [3, 1], [2, 1, 1]],
  5: [[5], [3, 2], [2, 2, 1], [2, 1, 1, 1]],
  6: [[6], [3, 3], [2, 2, 2], [3, 2, 1], [2, 2, 1, 1]],
  7: [[7], [4, 3], [3, 2, 2], [2, 2, 2, 1]],
  8: [[8], [4, 4], [2, 2, 2, 2], [3, 3, 2]],
};

export function formatDayDistribution(parts: number[]): string {
  return parts.join('+');
}

export function parseDayDistribution(input: string): number[] | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;
  const parts = s.split('+').map((x) => parseInt(x, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 1 || n > 8)) return null;
  return parts;
}

export function distributionPresetsForHours(hours: number): number[][] {
  const h = Math.max(1, Math.min(8, Math.floor(hours)));
  return DAY_DISTRIBUTION_PRESETS[h] ?? [[h]];
}

export function isValidDayDistribution(parts: number[], weeklyHours: number): boolean {
  if (!parts.length) return false;
  if (parts.some((n) => n < 1 || n > 8)) return false;
  return parts.reduce((s, n) => s + n, 0) === weeklyHours;
}

export function assignmentDayDistribution(options?: Record<string, unknown>): number[] | null {
  const raw = options?.day_distribution;
  if (!Array.isArray(raw)) return null;
  const parts = raw.map((n) => Number(n)).filter((n) => n >= 1 && n <= 8);
  return parts.length ? parts : null;
}

export function inferDayDistribution(
  weeklyHours: number,
  options?: Record<string, unknown>,
  biweekly?: boolean,
): number[] {
  const stored = assignmentDayDistribution(options);
  if (stored && isValidDayDistribution(stored, biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours)) {
    return stored;
  }
  const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const block = Number(options?.block_lessons ?? 0);
  if (block >= 2 && eff === block * 2) return [block, block];
  if (block >= 2 && eff === block) return [block];
  const presets = distributionPresetsForHours(eff);
  return presets[0] ?? [eff];
}

export function distributionToPlacementHints(parts: number[]): {
  min_days_per_week: number;
  max_per_day: number;
  block_lessons: number;
} {
  const maxChunk = Math.max(...parts);
  return {
    min_days_per_week: parts.length,
    max_per_day: maxChunk,
    block_lessons: maxChunk >= 2 ? maxChunk : 0,
  };
}
