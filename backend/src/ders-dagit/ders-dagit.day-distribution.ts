import { assignmentPlacementSpec } from './ders-dagit.assignment-blocks';
import type { DistributionMode, DistributionPolicy } from './ders-dagit.distribution-policy';
import { shouldEnforceDistributionPattern } from './ders-dagit.distribution-policy';
import { assignmentBlockLessons } from './ders-dagit.school-profile';

/** Haftalık ders dağılımı: 2+2, 2+1+1, 3+1, 4 … (gün başına saat sayıları) */

/** Eski sıra — tek güne toplama öncelikli (compact). */
export const DAY_DISTRIBUTION_PRESETS_COMPACT: Record<number, number[][]> = {
  1: [[1]],
  2: [[2], [1, 1]],
  3: [[3], [2, 1], [1, 1, 1]],
  4: [[4], [2, 2], [3, 1], [2, 1, 1]],
  5: [[5], [3, 2], [2, 2, 1], [2, 1, 1, 1]],
  6: [[6], [3, 3], [2, 2, 2], [3, 2, 1], [2, 2, 1, 1]],
  7: [[7], [4, 3], [3, 2, 2], [2, 2, 2, 1]],
  8: [[8], [4, 4], [2, 2, 2, 2], [3, 3, 2]],
};

/** Blok öncelikli: büyük ardışık bloklar önce (2, 2+2, 3+1 …). */
export const DAY_DISTRIBUTION_PRESETS_BLOCKS: Record<number, number[][]> = {
  1: [[1]],
  2: [[2], [1, 1]],
  3: [[3], [2, 1], [1, 1, 1]],
  4: [[4], [2, 2], [3, 1], [2, 1, 1]],
  5: [[5], [3, 2], [2, 2, 1], [2, 1, 1, 1]],
  6: [[6], [3, 3], [2, 2, 2], [3, 2, 1], [2, 2, 1, 1]],
  7: [[7], [4, 3], [3, 2, 2], [2, 2, 2, 1]],
  8: [[8], [4, 4], [2, 2, 2, 2], [3, 3, 2]],
};

/** Haftaya yay: küçük parçalar / farklı günler önce. */
export const DAY_DISTRIBUTION_PRESETS_SPREAD: Record<number, number[][]> = {
  1: [[1]],
  2: [[1, 1], [2]],
  3: [[2, 1], [1, 1, 1], [3]],
  4: [[2, 2], [3, 1], [2, 1, 1], [4]],
  5: [[2, 2, 1], [3, 2], [2, 1, 1, 1], [5]],
  6: [[2, 2, 2], [3, 3], [3, 2, 1], [2, 2, 1, 1], [6]],
  7: [[3, 2, 2], [2, 2, 2, 1], [4, 3], [7]],
  8: [[2, 2, 2, 2], [4, 4], [3, 3, 2], [8]],
};

/** spread ≈ blocks; compact = tek güne yığma öncelikli */
export const DAY_DISTRIBUTION_PRESETS = DAY_DISTRIBUTION_PRESETS_BLOCKS;

export function distributionPresetsForMode(hours: number, mode: DistributionMode = 'blocks'): number[][] {
  const h = Math.max(1, Math.min(8, Math.floor(hours)));
  if (mode === 'compact') return DAY_DISTRIBUTION_PRESETS_COMPACT[h] ?? [[h]];
  if (mode === 'spread') return DAY_DISTRIBUTION_PRESETS_SPREAD[h] ?? [[h]];
  return DAY_DISTRIBUTION_PRESETS_BLOCKS[h] ?? [[h]];
}

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

export function distributionPresetsForHours(hours: number, mode: DistributionMode = 'blocks'): number[][] {
  return distributionPresetsForMode(hours, mode);
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
  mode: DistributionMode = 'blocks',
): number[] {
  const stored = assignmentDayDistribution(options);
  if (stored && isValidDayDistribution(stored, biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours)) {
    return stored;
  }
  const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const block = Number(options?.block_lessons ?? 0);
  if (block >= 2 && eff === block * 2) return [block, block];
  if (block >= 2 && eff === block) return [block];
  const presets = distributionPresetsForHours(eff, mode);
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

/** Aynı blok boyutları, farklı gün sırası (2+2+1 → 1+2+2, 2+1+2 …). */
export function distinctPatternPermutations(pattern: number[]): number[][] {
  const out: number[][] = [];
  const used = new Set<string>();
  function permute(rest: number[], cur: number[]) {
    if (!rest.length) {
      const key = cur.join(',');
      if (!used.has(key)) {
        used.add(key);
        out.push([...cur]);
      }
      return;
    }
    const seen = new Set<number>();
    for (let i = 0; i < rest.length; i++) {
      const n = rest[i]!;
      if (seen.has(n)) continue;
      seen.add(n);
      const next = rest.slice(0, i).concat(rest.slice(i + 1));
      permute(next, [...cur, n]);
    }
  }
  permute([...pattern], []);
  return out.length ? out : [[...pattern]];
}

function multisetSubtractChunks(pattern: number[], observed: number[]): number[] | null {
  const remaining = [...pattern];
  for (const c of observed) {
    const idx = remaining.indexOf(c);
    if (idx < 0) return null;
    remaining.splice(idx, 1);
  }
  return remaining;
}

/** Ardışık ders saatlerini blok uzunluklarına böl (ör. [1,2,5,6] → [2,2]). */
function consecutiveRunLengths(lessons: number[]): number[] {
  if (!lessons.length) return [];
  const sorted = [...lessons].sort((a, b) => a - b);
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! === sorted[i - 1]! + 1) {
      run++;
    } else {
      runs.push(run);
      run = 1;
    }
  }
  runs.push(run);
  return runs;
}

/** Desen parçalarından toplamı `total` olan alt küme var mı — varsa remaining'den düş. */
function consumeChunksSummingTo(remaining: number[], total: number): boolean {
  if (total <= 0) return true;
  const idx = remaining.indexOf(total);
  if (idx >= 0) {
    remaining.splice(idx, 1);
    return true;
  }
  function backtrack(start: number, sum: number, picked: number[]): boolean {
    if (sum === total) {
      for (const i of [...picked].sort((a, b) => b - a)) remaining.splice(i, 1);
      return true;
    }
    if (sum > total) return false;
    for (let i = start; i < remaining.length; i++) {
      picked.push(i);
      if (backtrack(i + 1, sum + remaining[i]!, picked)) return true;
      picked.pop();
    }
    return false;
  }
  return backtrack(0, 0, []);
}

/** Gün içi ardışık yerleşimi desen bloklarıyla eşleştir (4 saat = 2+2). */
function subtractPlacedUsingDayRuns(
  remaining: number[],
  byDay: Map<number, number[]>,
): void {
  for (const lessons of byDay.values()) {
    if (!lessons.length) continue;
    for (const runLen of consecutiveRunLengths(lessons)) {
      if (!consumeChunksSummingTo(remaining, runLen)) {
        const idx = remaining.indexOf(runLen);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
  }
}

/** Kalan saatleri desen blok boyutlarına böl (ör. 4 saat, [2,2,1] → [2,2]). */
function decomposeRemainingHours(needHours: number, pattern: number[]): number[] {
  const sizes = [...new Set(pattern)].sort((a, b) => b - a);
  const out: number[] = [];
  let left = needHours;
  let guard = 0;
  while (left > 0 && guard++ < 16) {
    const pick = sizes.find((s) => s <= left) ?? 1;
    out.push(pick);
    left -= pick;
  }
  return out;
}

/** Hedef desenden kalan ardışık bloklar (saat toplamı doğru). */
export function remainingPatternChunks(
  assignmentId: string,
  entries: Array<{ assignment_id?: string | null; day_of_week: number; lesson_num: number }>,
  targetPattern: number[],
): number[] {
  const byDay = assignmentByDayLessons(entries, assignmentId);
  if (matchesDayDistributionPattern(byDay, targetPattern)) return [];

  const targetHours = targetPattern.reduce((s, n) => s + n, 0);
  const placedHours = [...byDay.values()].reduce((s, lessons) => s + lessons.length, 0);
  const needHours = Math.max(0, targetHours - placedHours);
  if (needHours <= 0) return [];

  const remaining = [...targetPattern];
  subtractPlacedUsingDayRuns(remaining, byDay);
  const sumRem = remaining.reduce((a, b) => a + b, 0);
  if (sumRem === needHours) return remaining;

  const observed = observedDayDistributionChunks(byDay);
  const subtracted = multisetSubtractChunks([...targetPattern], observed);
  if (subtracted !== null) {
    const sum = subtracted.reduce((a, b) => a + b, 0);
    if (sum === needHours) return subtracted;
  }

  return decomposeRemainingHours(needHours, targetPattern);
}

/** Desen parçaları aynı güne konamaz; ardışık ve aralıklı günler serbest (2+1 → Salı+Çarşamba OK). */
export function patternChunkDayAllowed(chunkDays: number[], candidateDay: number): boolean {
  return !chunkDays.includes(candidateDay);
}

/** @deprecated use patternChunkDayAllowed */
export const relaxSplitDayAllowed = patternChunkDayAllowed;

export function assignmentChunkDays(
  entries: Array<{ assignment_id?: string | null; day_of_week: number; lesson_num: number }>,
  assignmentId: string,
): number[] {
  const byDay = assignmentByDayLessons(entries, assignmentId);
  return [...byDay.keys()].filter((d) => (byDay.get(d)?.length ?? 0) > 0).sort((a, b) => a - b);
}

export function assignmentByDayLessons(
  entries: Array<{ assignment_id?: string | null; day_of_week: number; lesson_num: number }>,
  assignmentId: string,
): Map<number, number[]> {
  const byDay = new Map<number, Set<number>>();
  for (const e of entries) {
    if (e.assignment_id !== assignmentId) continue;
    let set = byDay.get(e.day_of_week);
    if (!set) {
      set = new Set();
      byDay.set(e.day_of_week, set);
    }
    set.add(e.lesson_num);
  }
  const out = new Map<number, number[]>();
  for (const [day, set] of byDay) {
    out.set(day, [...set].sort((a, b) => a - b));
  }
  return out;
}

/** Haftalık ardışık blok boyutları (gün sırası serbest). */
export function observedDayDistributionChunks(byDayLessons: Map<number, number[]>): number[] {
  const chunks: number[] = [];
  for (const lessons of byDayLessons.values()) {
    if (!lessons.length) continue;
    const sorted = [...lessons].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]! === sorted[i - 1]! + 1) {
        run++;
      } else {
        chunks.push(run);
        run = 1;
      }
    }
    chunks.push(run);
  }
  return chunks.sort((a, b) => a - b);
}

/** Yerleşim desenine uyuyor mu (ardışık blok boyutları çok kümesi). */
export function matchesDayDistributionPattern(
  byDayLessons: Map<number, number[]>,
  pattern: number[],
): boolean {
  const observed = observedDayDistributionChunks(byDayLessons);
  const expected = [...pattern].sort((a, b) => a - b);
  return (
    observed.length === expected.length && observed.every((c, i) => c === expected[i])
  );
}

export function assignmentHasStoredDistribution(options?: Record<string, unknown>): boolean {
  const raw = assignmentDayDistribution(options);
  return !!raw?.length;
}

/** Skor / ihlal: atama kartı + stüdyo politikasından beklenen haftalık blok deseni. */
export function distributionPatternForScoring(
  weeklyHours: number,
  options: Record<string, unknown> | undefined,
  biweekly: boolean | undefined,
  policy: DistributionPolicy | undefined,
): number[] | null {
  const eff = biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const stored = assignmentDayDistribution(options);
  if (stored && isValidDayDistribution(stored, eff)) return stored;

  const block = assignmentBlockLessons(options);
  const spec = assignmentPlacementSpec(options, weeklyHours, biweekly);
  if (block >= 2 && eff === block) return [block];
  if (block >= 2 && eff === block * 2) return [block, block];
  if (spec.day_distribution && isValidDayDistribution(spec.day_distribution, eff)) return spec.day_distribution;
  if (spec.block_size >= 2 && eff === spec.block_size) return [spec.block_size];
  if (spec.block_size >= 2 && eff === spec.block_size * 2) {
    return [spec.block_size, spec.block_size];
  }

  const mode = policy?.mode ?? 'blocks';
  if (shouldEnforceDistributionPattern(policy)) {
    return inferDayDistribution(weeklyHours, options, biweekly, mode);
  }
  if (mode === 'spread') return inferDayDistribution(weeklyHours, options, biweekly, 'spread');
  if (block >= 2 || spec.block_size >= 2) {
    return inferDayDistribution(weeklyHours, options, biweekly, 'blocks');
  }
  if (mode === 'blocks' && eff === 2) return [2];
  return null;
}
