import { ruleHint } from '@/lib/ders-dagit-hints';
import { blockedLessonsFromParams, planningRuleEmoji } from '@/lib/planning-rule-list-copy';
import {
  flowParamKey,
  getPlanningRuleFlow,
  minSubjectsForFlow,
  subjectsStepDone,
} from '@/lib/planning-rule-flow';

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
  param_key?: 'max' | 'max_run' | 'min_gap' | 'lesson_nums';
};

export type AdvancedRelationDef = {
  id: string;
  kart_kodu?: string;
  label_tr: string;
  hint?: string;
  catalog_key?: string;
  solver_supported: boolean;
  param_label?: string;
  param_key?: 'max' | 'max_run' | 'min_gap' | 'lesson_nums';
};

export { ruleUsesLessonSlotList, blockedLessonsFromParams } from '@/lib/planning-rule-list-copy';

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
  not_consecutive_same_hour: 'Aynı gün bitişik saatte olamaz',
  max_days_per_week_planning: 'Haftada en fazla ders günü',
  max_same_period_week: 'Haftada aynı saatte en fazla X gün',
  no_compact_week: 'Müfredattan hızlı yerleştirme yok',
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

export function minSubjectsForRule(ruleId: string, kind: 'simple' | 'advanced'): number {
  const flow = getPlanningRuleFlow(ruleId, kind);
  return minSubjectsForFlow(flow);
}

export function defaultParamsForRule(
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
): Record<string, unknown> | undefined {
  if (!def?.param_key) return undefined;
  if (def.param_key === 'max_run') return { max_run: 4 };
  if (def.param_key === 'min_gap') return { min_gap: 2 };
  if (def.param_key === 'lesson_nums') return { blocked_lessons: [] };
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
  const flow = getPlanningRuleFlow(row.rule_id, row.kind);
  const sectionsOk =
    row.sections_mode === 'all' || (row.sections.length > 0 && allSections.length > 0);
  const needsParam = flow.paramKind !== 'none';
  const paramOk =
    !needsParam ||
    (() => {
      if (flow.paramKind === 'lesson_nums') {
        return blockedLessonsFromParams(row.params).length >= 1;
      }
      const key = flowParamKey(flow.paramKind);
      if (!key) return true;
      const n = Number(row.params?.[key]);
      const min = flow.paramMin ?? 1;
      return Number.isFinite(n) && n >= min;
    })();

  const steps: PlanningConditionStep[] = [
    {
      id: 'rule',
      label: def ? `${flow.emoji} ${flow.title}` : 'Kural türü seçin',
      done: !!def,
      hint: flow.intro.slice(0, 120) + (flow.intro.length > 120 ? '…' : ''),
    },
  ];

  if (needsParam) {
    steps.push({
      id: 'params',
      label: flow.paramTitle ?? 'Sayısal ayar',
      done: paramOk,
      hint: flow.paramHint,
    });
  }

  steps.push(
    {
      id: 'subjects',
      label: flow.subjectTitle,
      done: subjectsStepDone(flow, row.subject_ids),
      hint: flow.subjectHint,
    },
    {
      id: 'sections',
      label: row.sections_mode === 'all' ? 'Tüm şubeler' : 'Şube seçimi',
      done: sectionsOk,
      hint:
        row.sections_mode === 'all'
          ? flow.sectionsHint
          : allSections.length
            ? `${row.sections.length} şube seçili`
            : 'Şube listesi boş — profil tanımlayın veya Tümü kullanın.',
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
  );

  return steps;
}

export function formatPlanningConditionSummary(
  row: PlanningRelationRow,
  def: SimpleRelationDef | AdvancedRelationDef | undefined,
): string {
  if (!def) return 'Kural ve kapsam seçilmedi.';
  const flow = getPlanningRuleFlow(row.rule_id, row.kind);
  let subj =
    row.subject_labels.length > 0 ? row.subject_labels.join(', ') : 'ders seçilmedi';
  if (flow.subjectMode === 'ordered_ab' && row.subject_labels.length === 2) {
    subj = `${row.subject_labels[0]} → ${row.subject_labels[1]}`;
  }
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
  if (flow.paramKind === 'lesson_nums') {
    const n = blockedLessonsFromParams(row.params).length;
    if (n) param = ` (${n} dilim)`;
  } else if (flow.paramKind !== 'none' && flow.paramTitle) {
    const key = flowParamKey(flow.paramKind);
    if (key) {
      const n = row.params?.[key];
      if (n != null) param = ` (${flow.paramTitle}: ${n})`;
    }
  }
  return `${flow.emoji} ${flow.title}: «${subj}» ${sec}, ${imp} uygulanır${param}.`;
}

export function simpleRuleOptionLabel(r: SimpleRelationDef): string {
  const tag = r.solver_supported ? ' · dağıtım' : ' · yakında';
  return `${r.label_tr}${tag}`;
}

export function advancedRuleOptionLabel(r: AdvancedRelationDef): string {
  const tag = r.solver_supported ? ' · dağıtım' : ' · yakında';
  return `${r.label_tr}${tag}`;
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
  const emoji = planningRuleEmoji(row.rule_id, row.kind);
  return `${emoji} ${base} · ${subj} · ${sec} · ${imp}`;
}

export function validatePlanningRelationRow(
  row: PlanningRelationRow,
  allSections: string[],
  simple: SimpleRelationDef[],
  advanced: AdvancedRelationDef[],
): { ok: true } | { ok: false; message: string } {
  const flow = getPlanningRuleFlow(row.rule_id, row.kind);
  if (!subjectsStepDone(flow, row.subject_ids)) {
    if (flow.subjectMode === 'pair_exactly_2' || flow.subjectMode === 'ordered_ab') {
      return { ok: false, message: `${flow.subjectTitle} — tam iki ders seçin.` };
    }
    if (!flow.subjectOptional) {
      return { ok: false, message: 'En az bir ders seçin.' };
    }
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
  if (flow.paramKind === 'lesson_nums') {
    if (blockedLessonsFromParams(row.params).length < 1) {
      return { ok: false, message: 'En az bir ders dilimini işaretleyin.' };
    }
  } else if (flow.paramKind !== 'none' && flow.paramTitle) {
    const key = flowParamKey(flow.paramKind);
    if (key) {
      const n = Number(row.params?.[key]);
      const min = flow.paramMin ?? 1;
      if (!Number.isFinite(n) || n < min) {
        return { ok: false, message: `${flow.paramTitle} için geçerli bir sayı girin (en az ${min}).` };
      }
    }
  }
  return { ok: true };
}

export function newRelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
