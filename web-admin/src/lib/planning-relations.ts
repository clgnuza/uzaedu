export type PlanningImportance = 'strict' | 'normal' | 'low';

export type PlanningRelationRow = {
  id: string;
  active: boolean;
  kind: 'simple' | 'advanced';
  rule_id: string;
  importance: PlanningImportance;
  note?: string;
  subject_ids: string[];
  subject_labels: string[];
  sections_mode: 'all' | 'pick';
  sections: string[];
  params?: Record<string, unknown>;
  sort_order: number;
};

export type SimpleRelationDef = {
  id: string;
  label_tr: string;
  hint?: string;
  catalog_key?: string;
  solver_supported: boolean;
};

export type AdvancedRelationDef = {
  id: string;
  asc_ref?: string;
  label_tr: string;
  hint?: string;
  catalog_key?: string;
  solver_supported: boolean;
  param_label?: string;
  param_key?: 'max' | 'max_run' | 'min_gap';
};

export function advancedRuleOptionLabel(r: AdvancedRelationDef): string {
  const ref = r.asc_ref ? `${r.asc_ref} ` : '';
  const tag = r.solver_supported ? ' · dağıtım' : ' · yakında';
  return `${ref}${r.label_tr}${tag}`;
}

export const IMPORTANCE_OPTIONS = [
  { value: 'strict' as const, label: 'Zorunlu (yüksek)' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'low' as const, label: 'Düşük öncelik' },
];

export function relationSummary(
  row: PlanningRelationRow,
  simple: SimpleRelationDef[],
  advanced: AdvancedRelationDef[],
): string {
  const def =
    row.kind === 'simple'
      ? simple.find((r) => r.id === row.rule_id)
      : advanced.find((r) => r.id === row.rule_id);
  const base = def?.label_tr ?? row.rule_id;
  const subj = row.subject_labels.length ? row.subject_labels.join(', ') : '—';
  const sec =
    row.sections_mode === 'all' ? 'Tüm sınıflar' : row.sections.length ? row.sections.join(', ') : '—';
  const imp = row.importance === 'strict' ? 'Zorunlu' : row.importance === 'low' ? 'Düşük' : 'Normal';
  const ref = def && 'asc_ref' in def && def.asc_ref ? ` ${def.asc_ref}` : '';
  return `${base}${ref} · ${subj} · ${sec} · ${imp}`;
}

export function newRelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
