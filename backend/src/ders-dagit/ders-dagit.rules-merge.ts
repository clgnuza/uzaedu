import { MEB_PE_MUSIC_DEFAULT_DAYS } from './ders-dagit.rules';
import {
  importanceWeight,
  relationDefinition,
  type PlanningRelationRow,
} from './ders-dagit.planning-relations';
import type { MebSchoolType, StudioSchoolProfile } from './ders-dagit.school-profile';
import type { RuleState } from './ders-dagit.solver';

export type ClassProfileRulesSlice = {
  id: string;
  class_sections?: string[];
  rules?: RuleState | null;
};

/** Planlama ilişkilerini stüdyo + şube kural setine uygular (DB yazmaz). */
export function mergePlanningRelationsIntoRules(
  studioRules: RuleState,
  profiles: ClassProfileRulesSlice[],
  relations: PlanningRelationRow[],
): { studio_rules: RuleState; section_rules: Map<string, RuleState> } {
  const studio: RuleState = { ...studioRules };
  const profileOverrides = new Map<string, RuleState>();

  for (const row of relations) {
    if (!row.active) continue;
    const def = relationDefinition(row);
    if (!def || !('catalog_key' in def) || !def.catalog_key) continue;
    let key = def.catalog_key;
    const maxN = Number(row.params?.max);
    if (key === 'max_two_per_day' && maxN === 1) key = 'max_one_per_day';
    const params: Record<string, unknown> = { ...(row.params ?? {}) };
    if (row.subject_ids.length) params.planning_subject_ids = row.subject_ids;
    const state = {
      active: true,
      weight: importanceWeight(row.importance),
      params: Object.keys(params).length ? params : studio[key]?.params,
    };
    if (row.sections_mode === 'all') {
      studio[key] = { ...studio[key], ...state };
    } else {
      for (const p of profiles) {
        const secs = p.class_sections ?? [];
        if (!secs.some((s) => row.sections.includes(s))) continue;
        const cur = profileOverrides.get(p.id) ?? { ...(p.rules ?? {}) };
        cur[key] = state;
        profileOverrides.set(p.id, cur);
      }
    }
  }

  const section_rules = new Map<string, RuleState>();
  for (const p of profiles) {
    const merged = { ...studio, ...(profileOverrides.get(p.id) ?? p.rules ?? {}) };
    for (const sec of p.class_sections ?? []) {
      const s = sec.trim();
      if (s) section_rules.set(s, merged);
    }
  }
  return { studio_rules: studio, section_rules };
}

const PE_MUSIC_SCHOOL_TYPES: MebSchoolType[] = [
  'ilkokul',
  'ortaokul',
  'anadolu_lise',
  'fen_lise',
  'aihl',
  'mtal',
];
const THEORY_PM_SCHOOL_TYPES: MebSchoolType[] = ['mtal', 'anadolu_lise', 'fen_lise', 'aihl'];

/** Okul türüne göre MEB pedagoji kurallarını dağıtımda etkinleştirir. */
export function applySchoolPedagogyRules(rules: RuleState, profile: StudioSchoolProfile): RuleState {
  const out: RuleState = { ...rules };
  const enable = (key: string, extra?: Partial<{ weight: number; params: Record<string, unknown> }>) => {
    const cur = out[key] ?? { active: false };
    out[key] = { ...cur, active: true, weight: cur.weight ?? extra?.weight, ...extra };
  };
  if (PE_MUSIC_SCHOOL_TYPES.includes(profile.type)) {
    const days =
      (out.meb_pe_music_days?.params as { days?: number[] } | undefined)?.days?.filter(
        (d) => d >= 1 && d <= 7,
      ) ?? [];
    enable('meb_pe_music_days', {
      params: { days: days.length ? days : [...MEB_PE_MUSIC_DEFAULT_DAYS] },
    });
  }
  if (THEORY_PM_SCHOOL_TYPES.includes(profile.type)) {
    enable('meb_theory_am_practical_pm');
  }
  return out;
}

export function buildStrictRuleKeys(relations: PlanningRelationRow[]): {
  global: Set<string>;
  bySection: Map<string, Set<string>>;
} {
  const global = new Set<string>();
  const bySection = new Map<string, Set<string>>();
  for (const row of relations) {
    if (!row.active || row.importance !== 'strict') continue;
    const def = relationDefinition(row);
    if (!def || !('catalog_key' in def) || !def.catalog_key || !def.solver_supported) continue;
    const key = def.catalog_key;
    if (row.sections_mode === 'all') {
      global.add(key);
    } else {
      for (const sec of row.sections) {
        const s = sec.trim();
        if (!s) continue;
        const set = bySection.get(s) ?? new Set<string>();
        set.add(key);
        bySection.set(s, set);
      }
    }
  }
  return { global, bySection };
}

/** Açık stüdyo/şube kurallarını üretimde zorunlu say (skor 100 / STRICT_RULES_VIOLATED). */
export function augmentStrictKeysWithActiveRules(
  strictKeys: { global: Set<string>; bySection: Map<string, Set<string>> },
  studioRules: RuleState,
  sectionRules: Map<string, RuleState>,
): void {
  for (const [key, st] of Object.entries(studioRules)) {
    if (st?.active) strictKeys.global.add(key);
  }
  for (const [sec, rules] of sectionRules) {
    for (const [key, st] of Object.entries(rules)) {
      if (!st?.active) continue;
      const set = strictKeys.bySection.get(sec) ?? new Set<string>();
      set.add(key);
      strictKeys.bySection.set(sec, set);
    }
  }
}

export function isStrictRule(
  ctx: {
    strict_rule_keys_global?: Set<string>;
    strict_rule_keys_by_section?: Map<string, Set<string>>;
  },
  key: string,
  section: string,
): boolean {
  if (ctx.strict_rule_keys_global?.has(key)) return true;
  return !!ctx.strict_rule_keys_by_section?.get(section)?.has(key);
}

export function validatePlanningRelationsForGenerate(relations: PlanningRelationRow[]): Array<{
  code: string;
  severity: 'error';
  message: string;
}> {
  const issues: Array<{ code: string; severity: 'error'; message: string }> = [];
  for (const row of relations) {
    if (!row.active || row.importance !== 'strict') continue;
    const def = relationDefinition(row);
    if (!def || def.solver_supported) continue;
    issues.push({
      code: 'PLANNING_STRICT_UNSUPPORTED',
      severity: 'error',
      message: `Zorunlu planlama kuralı henüz dağıtımda desteklenmiyor: ${def.label_tr}`,
    });
  }
  return issues;
}
