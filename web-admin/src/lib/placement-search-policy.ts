import { apiFetch } from '@/lib/api';
import type { PlacementSearchComplexity } from '@/lib/timetable-placement-budget';
import { PLACEMENT_SEARCH_BUDGETS } from '@/lib/timetable-placement-budget';

export type PlacementSearchPolicyDto = {
  search_complexity: PlacementSearchComplexity;
  conflict_mode: 'auto_relocate' | 'ask';
  allow_ignore_clash: boolean;
};

export const DEFAULT_PLACEMENT_SEARCH_POLICY: PlacementSearchPolicyDto = {
  search_complexity: 'large',
  conflict_mode: 'auto_relocate',
  allow_ignore_clash: true,
};

export function parsePlacementSearchPolicyDto(raw: unknown): PlacementSearchPolicyDto {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PLACEMENT_SEARCH_POLICY };
  const o = raw as Partial<PlacementSearchPolicyDto>;
  const c = o.search_complexity;
  return {
    search_complexity: c === 'normal' || c === 'huge' ? c : 'large',
    conflict_mode: o.conflict_mode === 'ask' ? 'ask' : 'auto_relocate',
    allow_ignore_clash: o.allow_ignore_clash !== false,
  };
}

const COMPLEXITY_LABEL: Record<PlacementSearchComplexity, string> = {
  normal: 'Normal',
  large: 'Geniş',
  huge: 'Çok geniş',
};

export function placementSearchSummary(p: PlacementSearchPolicyDto): string {
  const b = PLACEMENT_SEARCH_BUDGETS[p.search_complexity];
  const total = (b.maxNodes * b.restarts).toLocaleString('tr-TR');
  return `${COMPLEXITY_LABEL[p.search_complexity]} arama (~${total} olasılık/tur, üretimde CSP+LAHC)`;
}

/** Backend `GENERATION_SEARCH_BUDGETS.minDurationSec` ile aynı. */
export const GENERATION_MIN_DURATION_SEC: Record<PlacementSearchComplexity, number> = {
  normal: 90,
  large: 180,
  huge: 420,
};

export function generationMinDurationSec(
  complexity?: PlacementSearchComplexity | null,
): number {
  const c = complexity ?? 'large';
  return GENERATION_MIN_DURATION_SEC[c] ?? GENERATION_MIN_DURATION_SEC.large;
}

export async function fetchPlacementSearchPolicy(
  token: string,
  studioId: string,
): Promise<PlacementSearchPolicyDto> {
  const raw = await apiFetch<PlacementSearchPolicyDto>(
    `/ders-dagit/studios/${studioId}/placement-search`,
    { token },
  );
  return parsePlacementSearchPolicyDto(raw);
}

export async function patchPlacementSearchPolicy(
  token: string,
  studioId: string,
  body: Partial<PlacementSearchPolicyDto>,
): Promise<PlacementSearchPolicyDto> {
  const raw = await apiFetch<PlacementSearchPolicyDto>(
    `/ders-dagit/studios/${studioId}/placement-search`,
    { token, method: 'PATCH', body },
  );
  return parsePlacementSearchPolicyDto(raw);
}
