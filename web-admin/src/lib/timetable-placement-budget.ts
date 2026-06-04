/** Sürükle-bırak / havuz yerleştirmede UI donmasını önlemek için BFS sınırları. */
export const POOL_PLACEMENT_BFS = { maxDepth: 8, maxNodes: 1800, maxMs: 120 } as const;
export const ENTRY_MOVE_BFS = { maxDepth: 10, maxNodes: 3500, maxMs: 150 } as const;
export const BLOCK_MOVE_BFS = { maxDepth: 8, maxNodes: 2500, maxMs: 120 } as const;

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
