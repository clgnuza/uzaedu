import type { RuleState, SolverContext } from './ders-dagit.solver';

function deactivateRules(rules: RuleState): RuleState {
  const out: RuleState = {};
  for (const [key, rule] of Object.entries(rules)) {
    out[key] = { ...rule, active: false };
  }
  return out;
}

/** Tek seferlik üretim: desen zorunluluğu ve stüdyo kurallarını çözücüde gevşetir (kalıcı ayar değişmez). */
export function applyGenerateRelaxToContext(ctx: SolverContext): SolverContext {
  const section_rules = new Map<string, RuleState>();
  for (const [sec, rules] of ctx.section_rules) {
    section_rules.set(sec, deactivateRules(rules));
  }
  const active_rules = deactivateRules(ctx.active_rules);
  return {
    ...ctx,
    relax_constraints: true,
    distribution_policy: {
      mode: ctx.distribution_policy?.mode ?? 'blocks',
      enforce_pattern: false,
      relax_on_conflict: true,
    },
    strict_rule_keys_global: new Set(),
    strict_rule_keys_by_section: new Map(),
    active_rules,
    section_rules,
    room_required: false,
    no_building_same_day: false,
  };
}
