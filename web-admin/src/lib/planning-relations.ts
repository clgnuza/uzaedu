import { kartKoduPrefix } from '@/lib/plan-karti';
import { ruleHint } from '@/lib/ders-dagit-hints';

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
  param_label?: string;
  param_key?: 'max' | 'max_run' | 'min_gap';
};

export type AdvancedRelationDef = {
  id: string;
  kart_kodu?: string;
  label_tr: string;
  hint?: string;
  catalog_key?: string;
  solver_supported: boolean;
  param_label?: string;
  param_key?: 'max' | 'max_run' | 'min_gap';
};

/** Okul kuralı anahtarı → Türkçe etiket (ham kod göstermemek için). */
export const PLANNING_CATALOG_LABELS: Record<string, string> = {
  two_not_same_day: 'Haftada 2 saat — farklı günlerde',
  two_same_day: 'Haftada 2 saat — aynı günde',
  distribute_week: 'Dersler haftaya yayılır',
  same_day_consecutive: 'Aynı gün ardışık saatlerde',
  max_one_per_day: 'Günde en fazla 1 saat aynı ders',
  max_two_per_day: 'Günde en fazla 2 saat aynı ders',
  four_plus_consecutive: 'Günde 4 saatten fazla ardışık ders yok',
  minimize_teacher_gaps: 'Öğretmenin boş saatleri az',
  group_parallel_same_slot: 'Bölünmüş sınıflar aynı saatte',
  important_early: 'Önemli dersler günün erken saatlerinde',
  two_two_day_gap: 'Haftada 2 saat — arada 1 gün boşluk',
  fixed_slots: 'Önceden belirlenen saatler değişmez',
};

export function catalogKeyLabel(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return PLANNING_CATALOG_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function planningCatalogRuleLabel(key: string | undefined): string | null {
  const label = catalogKeyLabel(key);
  return label ?? null;
}

export function planningCatalogRuleHint(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return ruleHint(key);
}

/** İki veya daha fazla ders kartı arası ilişki (Plan Kartı). */
const MIN_TWO_SUBJECT_RULE_IDS = new Set([
  'adv_same_hour',
  'adv_same_day',
  'adv_must_same_day',
  'adv_not_consecutive_same_day',
  'adv_parallel_start',
  'adv_a_before_b_week',
]);

export function minSubjectsForRule(ruleId: string, kind: 'simple' | 'advanced'): number {
  if (kind === 'advanced' && MIN_TWO_SUBJECT_RULE_IDS.has(ruleId)) return 2;
  return 1;
}

export function defaultParamsForRule(
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
): Record<string, number> | undefined {
  if (!def?.param_key) return undefined;
  if (def.param_key === 'max_run') return { max_run: 4 };
  if (def.param_key === 'min_gap') return { min_gap: 2 };
  return { max: 2 };
}

export function defaultImportanceForRule(
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
): PlanningImportance {
  if (!def?.solver_supported) return 'normal';
  return 'strict';
}

export type PlanningConditionStep = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export function planningRelationConditionSteps(
  row: PlanningRelationRow,
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
  allSections: string[],
): PlanningConditionStep[] {
  const minSubj = def ? minSubjectsForRule(row.rule_id, row.kind) : 1;
  const sectionsOk =
    row.sections_mode === 'all' || (row.sections.length > 0 && allSections.length > 0);
  const paramOk =
    !def?.param_key ||
    (() => {
      const key =
        def.param_key === 'max_run' ? 'max_run' : def.param_key === 'min_gap' ? 'min_gap' : 'max';
      const n = Number(row.params?.[key]);
      return Number.isFinite(n) && n >= 1;
    })();

  return [
    {
      id: 'rule',
      label: def ? def.label_tr : 'Kural türü seçin',
      done: !!def,
    },
    {
      id: 'subjects',
      label:
        minSubj > 1
          ? `En az ${minSubj} ders (kart ilişkisi)`
          : 'En az 1 ders',
      done: row.subject_ids.length >= minSubj,
      hint:
        minSubj > 1
          ? 'Seçilen derslerin atamaları birlikte değerlendirilir.'
          : 'Yalnız işaretli derslerin atamalarına uygulanır.',
    },
    {
      id: 'sections',
      label: row.sections_mode === 'all' ? 'Tüm şubeler' : 'Şube seçimi',
      done: sectionsOk,
      hint:
        row.sections_mode === 'all'
          ? 'Okul genelinde geçerli.'
          : allSections.length
            ? `${row.sections.length} şube seçili`
            : 'Şube listesi boş — profil tanımlayın veya Tümü kullanın.',
    },
    {
      id: 'params',
      label: def?.param_label ?? 'Sayısal koşul',
      done: !def?.param_key || paramOk,
      hint: def?.param_label ? 'Zorunlu parametre' : undefined,
    },
    {
      id: 'distribution',
      label: def?.solver_supported ? 'Dağıtımda uygulanır' : 'Yalnızca kayıt (yakında)',
      done: row.importance !== 'strict' || !!def?.solver_supported,
      hint:
        row.importance === 'strict' && def && !def.solver_supported
          ? 'Zorunlu yapılamaz — önce Normal seçin veya başka kural kullanın.'
          : undefined,
    },
  ].filter((s) => s.id !== 'params' || !!def?.param_key);
}

export function formatPlanningConditionSummary(
  row: PlanningRelationRow,
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
): string {
  if (!def) return 'Kural ve kapsam seçilmedi.';
  const subj =
    row.subject_labels.length > 0 ? row.subject_labels.join(', ') : 'ders seçilmedi';
  const sec =
    row.sections_mode === 'all'
      ? 'tüm şubelerde'
      : row.sections.length
        ? `${row.sections.join(', ')} şubelerinde`
        : 'şube seçilmedi';
  const imp =
    row.importance === 'strict'
      ? 'zorunlu'
      : row.importance === 'low'
        ? 'düşük öncelikle'
        : 'normal öncelikle';
  let param = '';
  if (def.param_key && def.param_label) {
    const key =
      def.param_key === 'max_run' ? 'max_run' : def.param_key === 'min_gap' ? 'min_gap' : 'max';
    const n = row.params?.[key];
    if (n != null) param = ` (${def.param_label}: ${n})`;
  }
  const kod = 'kart_kodu' in def && def.kart_kodu ? ` ${def.kart_kodu}` : '';
  return `${def.label_tr}${kod}: «${subj}» ${sec}, ${imp} uygulanır${param}.`;
}

export function simpleRuleOptionLabel(r: SimpleRelationDef): string {
  const tag = r.solver_supported ? ' · dağıtım' : ' · yakında';
  return `${r.label_tr}${tag}`;
}

export function advancedRuleOptionLabel(r: AdvancedRelationDef): string {
  const tag = r.solver_supported ? ' · dağıtım' : ' · yakında';
  return `${kartKoduPrefix(r)}${r.label_tr}${tag}`;
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
  const kod = def && 'kart_kodu' in def ? def.kart_kodu : undefined;
  const ref = kod ? ` ${kod}` : '';
  return `${base}${ref} · ${subj} · ${sec} · ${imp}`;
}

export function validatePlanningRelationRow(
  row: PlanningRelationRow,
  allSections: string[],
  simple: SimpleRelationDef[],
  advanced: AdvancedRelationDef[],
): { ok: true } | { ok: false; message: string } {
  const minSubj = minSubjectsForRule(row.rule_id, row.kind);
  if (row.subject_ids.length < minSubj) {
    return {
      ok: false,
      message:
        minSubj > 1
          ? `Bu ilişki için en az ${minSubj} ders seçin (kartlar arası koşul).`
          : 'En az bir ders seçin.',
    };
  }
  if (row.sections_mode === 'pick' && row.sections.length === 0) {
    return {
      ok: false,
      message: allSections.length
        ? 'Sınıf seçimi modunda en az bir şube işaretleyin.'
        : 'Şube listesi boş — önce sınıf profili tanımlayın veya “Tümü” kullanın.',
    };
  }
  const def =
    row.kind === 'simple'
      ? simple.find((r) => r.id === row.rule_id)
      : advanced.find((r) => r.id === row.rule_id);
  if (!def) {
    return { ok: false, message: 'Geçersiz kural türü seçildi.' };
  }
  if (row.importance === 'strict' && !def.solver_supported) {
    return {
      ok: false,
      message: `“${def.label_tr}” zorunlu yapılamaz — dağıtımda henüz desteklenmiyor.`,
    };
  }
  if (def.param_key && def.param_label) {
    const key =
      def.param_key === 'max_run' ? 'max_run' : def.param_key === 'min_gap' ? 'min_gap' : 'max';
    const n = Number(row.params?.[key]);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, message: `${def.param_label} için geçerli bir sayı girin (en az 1).` };
    }
  }
  return { ok: true };
}

export function newRelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
