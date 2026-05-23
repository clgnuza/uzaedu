import type { SolverAssignment, SolverContext } from './ders-dagit.solver';
import { rulesForSection } from './ders-dagit.solver';

/** Kural şube düzeyinde açık mı (atama bağlamı yok). */
export function ruleOn(ctx: SolverContext, key: string, section: string): boolean {
  return !!rulesForSection(ctx, section)[key]?.active;
}

/** Plan Kartı ders filtresi varsa yalnızca seçili ders atamalarına uygulanır. */
export function ruleOnForAssignment(
  ctx: SolverContext,
  key: string,
  section: string,
  a: SolverAssignment,
): boolean {
  const r = rulesForSection(ctx, section)[key];
  if (!r?.active) return false;
  const ids = r.params?.planning_subject_ids as string[] | undefined;
  if (!ids?.length) return true;
  return !!(a.subject_id && ids.includes(a.subject_id));
}
