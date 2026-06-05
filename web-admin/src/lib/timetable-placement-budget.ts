/** Sürükle-bırak / havuz yerleştirmede arama bütçesi (aSc complexity benzeri). */

export type PlacementSearchComplexity = 'normal' | 'large' | 'huge';

export type PlacementBfsBudget = {
  maxDepth: number;
  maxNodes: number;
  maxMs: number;
  maxTargetsPerCard: number;
  restarts: number;
  chunkNodes: number;
};

export const PLACEMENT_SEARCH_BUDGETS: Record<PlacementSearchComplexity, PlacementBfsBudget> = {
  normal: {
    maxDepth: 14,
    maxNodes: 120_000,
    maxMs: 4_000,
    maxTargetsPerCard: 64,
    restarts: 4,
    chunkNodes: 10_000,
  },
  large: {
    maxDepth: 18,
    maxNodes: 1_200_000,
    maxMs: 25_000,
    maxTargetsPerCard: 128,
    restarts: 12,
    chunkNodes: 20_000,
  },
  huge: {
    maxDepth: 24,
    maxNodes: 5_000_000,
    maxMs: 120_000,
    maxTargetsPerCard: 999,
    restarts: 24,
    chunkNodes: 40_000,
  },
};

export function placementBudgetFor(complexity: PlacementSearchComplexity): PlacementBfsBudget {
  return PLACEMENT_SEARCH_BUDGETS[complexity] ?? PLACEMENT_SEARCH_BUDGETS.large;
}

/** @deprecated doğrudan placementBudgetFor kullanın */
export const POOL_PLACEMENT_BFS = PLACEMENT_SEARCH_BUDGETS.large;
export const ENTRY_MOVE_BFS = PLACEMENT_SEARCH_BUDGETS.large;
export const BLOCK_MOVE_BFS = PLACEMENT_SEARCH_BUDGETS.large;

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
