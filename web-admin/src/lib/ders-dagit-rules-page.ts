import { PLANNING_CATALOG_LABELS } from '@/lib/planning-relations';

/** Planlama ilişkilerinde ders/şube bazlı tanımlanan okul kuralları — Kurallar sayfasında gösterilmez. */
export const PLANNING_MANAGED_RULE_KEYS = new Set(Object.keys(PLANNING_CATALOG_LABELS));

export function filterRulesPageCatalog<T extends { key: string }>(catalog: T[]): T[] {
  return catalog.filter((c) => !PLANNING_MANAGED_RULE_KEYS.has(c.key));
}
