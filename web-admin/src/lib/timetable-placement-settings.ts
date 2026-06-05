import type { PlacementSearchComplexity } from '@/lib/timetable-placement-budget';
import {
  DEFAULT_PLACEMENT_SEARCH_POLICY,
  type PlacementSearchPolicyDto,
} from '@/lib/placement-search-policy';

export type DragPlacementConflictMode = 'auto_relocate' | 'ask';

/** Stüdyo placement-search ile aynı şema (editör + üretim). */
export type TimetablePlacementSettings = PlacementSearchPolicyDto;

export const DEFAULT_TIMETABLE_PLACEMENT_SETTINGS = DEFAULT_PLACEMENT_SEARCH_POLICY;

const STORAGE_KEY = 'ogretmenpro.timetable-placement-settings';

export function loadTimetablePlacementSettings(): TimetablePlacementSettings {
  if (typeof window === 'undefined') return DEFAULT_TIMETABLE_PLACEMENT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TIMETABLE_PLACEMENT_SETTINGS;
    const o = JSON.parse(raw) as Partial<TimetablePlacementSettings>;
    const complexity = o.search_complexity;
    return {
      conflict_mode: o.conflict_mode === 'ask' ? 'ask' : 'auto_relocate',
      allow_ignore_clash: o.allow_ignore_clash !== false,
      search_complexity:
        complexity === 'normal' || complexity === 'huge' ? complexity : 'large',
    };
  } catch {
    return DEFAULT_TIMETABLE_PLACEMENT_SETTINGS;
  }
}

export function saveTimetablePlacementSettingsLocal(next: TimetablePlacementSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export type { PlacementSearchComplexity };
