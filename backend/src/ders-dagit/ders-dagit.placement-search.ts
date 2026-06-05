/** Sürükle-bırak + program üretimi arama karmaşıklığı (stüdyo ayarı). */

export type PlacementSearchComplexity = 'normal' | 'large' | 'huge';

export type PlacementSearchPolicy = {
  search_complexity: PlacementSearchComplexity;
  conflict_mode: 'auto_relocate' | 'ask';
  allow_ignore_clash: boolean;
};

export const DEFAULT_PLACEMENT_SEARCH_POLICY: PlacementSearchPolicy = {
  search_complexity: 'large',
  conflict_mode: 'auto_relocate',
  allow_ignore_clash: true,
};

export type GenerationSearchBudget = {
  minDurationSec: number;
  cspPerSlot: number;
  cspMaxNodesCap: number;
  patternRetryMax: number;
  ascLahcMul: number;
  ascRestartEvery: number;
  ascDiversifyMoves: number;
  ascFinishStagnantCapMul: number;
};

export const GENERATION_SEARCH_BUDGETS: Record<PlacementSearchComplexity, GenerationSearchBudget> = {
  normal: {
    minDurationSec: 90,
    cspPerSlot: 200,
    cspMaxNodesCap: 200_000,
    patternRetryMax: 6,
    ascLahcMul: 1,
    ascRestartEvery: 400,
    ascDiversifyMoves: 6,
    ascFinishStagnantCapMul: 1,
  },
  large: {
    minDurationSec: 180,
    cspPerSlot: 420,
    cspMaxNodesCap: 900_000,
    patternRetryMax: 12,
    ascLahcMul: 1.55,
    ascRestartEvery: 220,
    ascDiversifyMoves: 12,
    ascFinishStagnantCapMul: 1.6,
  },
  huge: {
    minDurationSec: 420,
    cspPerSlot: 1200,
    cspMaxNodesCap: 4_000_000,
    patternRetryMax: 24,
    ascLahcMul: 2.4,
    ascRestartEvery: 100,
    ascDiversifyMoves: 24,
    ascFinishStagnantCapMul: 2.5,
  },
};

export function parsePlacementSearchPolicy(raw: unknown): PlacementSearchPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PLACEMENT_SEARCH_POLICY };
  const o = raw as Partial<PlacementSearchPolicy>;
  const c = o.search_complexity;
  return {
    search_complexity: c === 'normal' || c === 'huge' ? c : 'large',
    conflict_mode: o.conflict_mode === 'ask' ? 'ask' : 'auto_relocate',
    allow_ignore_clash: o.allow_ignore_clash !== false,
  };
}

export function generationBudgetFor(complexity: PlacementSearchComplexity): GenerationSearchBudget {
  return GENERATION_SEARCH_BUDGETS[complexity] ?? GENERATION_SEARCH_BUDGETS.large;
}

/** Üretim meta: tahmini denenen kombinasyon üst sınırı */
export function estimateGenerationSearchCap(
  complexity: PlacementSearchComplexity,
  targetSlots: number,
  durationSec: number,
): number {
  const b = generationBudgetFor(complexity);
  const cspCap = Math.min(b.cspMaxNodesCap, Math.max(30_000, targetSlots * b.cspPerSlot));
  const ascPerSec = complexity === 'huge' ? 18_000 : complexity === 'large' ? 9_000 : 4_000;
  return Math.round(cspCap + durationSec * ascPerSec * (1 + b.patternRetryMax * 0.35));
}
