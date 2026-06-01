/** Haftalık ders dağılımı (2+2, 3+1, …) */

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

export function distributionOptionsForHours(hours: number): Array<{ value: string; label: string; parts: number[] }> {
  const h = Math.max(1, Math.min(8, Math.floor(hours)));
  const presets = DAY_DISTRIBUTION_PRESETS[h] ?? [[h]];
  return presets.map((parts) => ({
    value: formatDayDistribution(parts),
    label: formatDayDistribution(parts),
    parts,
  }));
}

export function isValidDayDistribution(parts: number[], weeklyHours: number): boolean {
  if (!parts.length) return false;
  if (parts.some((n) => n < 1 || n > 8)) return false;
  return parts.reduce((s, n) => s + n, 0) === weeklyHours;
}

export function inferDayDistribution(
  weeklyHours: number,
  options?: Record<string, unknown>,
  biweekly?: boolean,
): number[] {
  const raw = options?.day_distribution;
  if (Array.isArray(raw)) {
    const parts = raw.map((n) => Number(n)).filter((n) => n >= 1 && n <= 8);
    const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
    if (isValidDayDistribution(parts, eff)) return parts;
  }
  const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const block = Number(options?.block_lessons ?? 0);
  if (block >= 2 && eff === block * 2) return [block, block];
  if (block >= 2 && eff === block) return [block];
  const presets = DAY_DISTRIBUTION_PRESETS[eff] ?? [[eff]];
  return presets[0] ?? [eff];
}

export function distributionToPlacementHints(parts: number[]) {
  return {
    min_days_per_week: parts.length,
    max_per_day: Math.max(...parts),
    block_lessons: Math.max(...parts) >= 2 ? Math.max(...parts) : 0,
  };
}
