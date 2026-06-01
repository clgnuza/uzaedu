/** Plan Kartı — planlama ilişkileri kayıt modeli ve kural eşlemesi */

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
  /** params alanı: max, max_run, min_gap, lesson_nums → blocked_lessons */
  param_key?: 'max' | 'max_run' | 'min_gap' | 'lesson_nums';
};

export const SIMPLE_PLANNING_RULES: SimpleRelationDef[] = [
  {
    id: 'not_same_day',
    label_tr: 'Dersler aynı gün yerleştirilemez',
    catalog_key: 'two_not_same_day',
    solver_supported: true,
  },
  {
    id: 'not_consecutive_same_day',
    label_tr: 'Dersler aynı gün ardarda yerleştirilemez',
    hint: 'Aynı gün bitişik saat yok',
    catalog_key: 'not_consecutive_same_hour',
    solver_supported: true,
  },
  {
    id: 'distribute_week',
    label_tr: 'Ders kartlarının günlere dağılımı',
    catalog_key: 'distribute_week',
    solver_supported: true,
  },
  {
    id: 'single_day',
    label_tr: 'Dersler bir güne yerleştirilmelidir',
    catalog_key: 'two_same_day',
    solver_supported: true,
  },
  {
    id: 'consecutive',
    label_tr: 'Dersler ardarda yerleştirilmelidir',
    catalog_key: 'same_day_consecutive',
    solver_supported: true,
  },
  {
    id: 'parallel_start',
    label_tr: 'Grup olarak tanımlanan dersler aynı anda başlasın',
    catalog_key: 'group_parallel_same_slot',
    solver_supported: true,
  },
  {
    id: 'first_or_last_period',
    label_tr: 'Dersler ilk veya son saatte başlasın / bitsin',
    catalog_key: 'important_early',
    solver_supported: true,
  },
  {
    id: 'max_consecutive',
    label_tr: 'En fazla ardışık ders sayısı sınırı',
    catalog_key: 'four_plus_consecutive',
    solver_supported: true,
    param_label: 'Max ardışık',
    param_key: 'max_run',
  },
  {
    id: 'max_per_day',
    label_tr: 'Günde en fazla ders sayısı',
    catalog_key: 'max_two_per_day',
    solver_supported: true,
    param_label: 'Max/gün',
    param_key: 'max',
  },
  {
    id: 'minimize_gaps',
    label_tr: 'Boş saat (pencere) en az olsun',
    catalog_key: 'minimize_teacher_gaps',
    solver_supported: true,
  },
];

export const ADVANCED_PLANNING_RULES: AdvancedRelationDef[] = [
  {
    id: 'adv_same_hour',
    kart_kodu: '#21',
    label_tr: 'Seçilen kartlar aynı saatte olamaz',
    hint: 'İki kayıt çakışması (farklı ders/öğretmen)',
    solver_supported: true,
  },
  {
    id: 'adv_same_day',
    kart_kodu: '#1',
    label_tr: 'Seçilen kartlar aynı gün olamaz',
    hint: '2 saatlik kartlar farklı günlerde',
    catalog_key: 'two_not_same_day',
    solver_supported: true,
  },
  {
    id: 'adv_must_same_day',
    kart_kodu: '#2',
    label_tr: 'Seçilen kartlar aynı günde olmalı',
    hint: '2 saatlik kartlar tek günde',
    catalog_key: 'two_same_day',
    solver_supported: true,
  },
  {
    id: 'adv_not_consecutive_same_day',
    kart_kodu: '#3',
    label_tr: 'Aynı gün ardışık saatte olamaz',
    hint: 'Bitişik saat yasak',
    catalog_key: 'not_consecutive_same_hour',
    solver_supported: true,
  },
  {
    id: 'adv_max_gap',
    kart_kodu: '#4',
    label_tr: 'Günde en fazla boş ders (pencere)',
    param_label: 'Max boş',
    param_key: 'max',
    catalog_key: 'minimize_teacher_gaps',
    hint: 'Öğretmen bazlı; yumuşak öncelik',
    solver_supported: true,
  },
  {
    id: 'adv_max_consecutive',
    kart_kodu: '#6',
    label_tr: 'En fazla ardışık ders sayısı',
    param_label: 'Max ardışık',
    param_key: 'max_run',
    catalog_key: 'four_plus_consecutive',
    solver_supported: true,
  },
  {
    id: 'adv_min_gap_days',
    kart_kodu: '#77',
    label_tr: 'İki ders arasında en az boş gün',
    param_label: 'Min gün arası',
    param_key: 'min_gap',
    catalog_key: 'two_two_day_gap',
    hint: '2 saatlik haftalık kartlar',
    solver_supported: true,
  },
  {
    id: 'adv_max_days_week',
    kart_kodu: '#0',
    label_tr: 'Haftada en fazla ders günü sayısı',
    param_label: 'Max gün',
    param_key: 'max',
    hint: 'Atama kartındaki max gün yoksa bu değer uygulanır',
    catalog_key: 'max_days_per_week_planning',
    solver_supported: true,
  },
  {
    id: 'adv_max_per_day',
    kart_kodu: '#10',
    label_tr: 'Günde en fazla ders sayısı',
    param_label: 'Max/gün',
    param_key: 'max',
    catalog_key: 'max_two_per_day',
    solver_supported: true,
  },
  {
    id: 'adv_max_same_period',
    kart_kodu: '#59',
    label_tr: 'Aynı derste haftada aynı saatte en fazla X gün',
    param_label: 'Max gün',
    param_key: 'max',
    hint: 'Haftada aynı saatte en fazla X gün',
    catalog_key: 'max_same_period_week',
    solver_supported: true,
  },
  {
    id: 'adv_parallel_start',
    kart_kodu: '#45',
    label_tr: 'Grup kartları aynı anda başlasın',
    catalog_key: 'group_parallel_same_slot',
    solver_supported: true,
  },
  {
    id: 'adv_a_before_b_week',
    kart_kodu: '#41',
    label_tr: 'Hafta içinde A dersleri B’den önce',
    hint: 'İlk seçilen ders A, ikinci B (sıra önemli)',
    solver_supported: true,
  },
  {
    id: 'adv_fixed_hours',
    kart_kodu: '#60',
    label_tr: 'Kartlar yalnızca seçilen saatlerde',
    catalog_key: 'fixed_slots',
    hint: 'Atamalarda sabit slot tanımlayın',
    solver_supported: true,
  },
  {
    id: 'adv_no_start_hour',
    kart_kodu: '#32',
    label_tr: 'Seçilen saatlerde ders başlayamaz',
    hint: 'Yasak dilimleri madde listesinden işaretleyin',
    param_key: 'lesson_nums',
    solver_supported: true,
  },
  {
    id: 'adv_no_end_hour',
    kart_kodu: '#33',
    label_tr: 'Seçilen saatlerde ders bitemez',
    hint: 'Bitiş yasak dilimlerini madde listesinden seçin',
    param_key: 'lesson_nums',
    solver_supported: true,
  },
  {
    id: 'adv_faster_than_curriculum',
    kart_kodu: '#64',
    label_tr: 'Müfredattan hızlı yerleştirme yok',
    catalog_key: 'no_compact_week',
    solver_supported: true,
  },
];

export function importanceWeight(imp: PlanningImportance): number {
  if (imp === 'strict') return 14;
  if (imp === 'low') return 3;
  return 8;
}

export function relationDefinition(row: PlanningRelationRow): SimpleRelationDef | AdvancedRelationDef | undefined {
  if (row.kind === 'simple') return SIMPLE_PLANNING_RULES.find((r) => r.id === row.rule_id);
  return ADVANCED_PLANNING_RULES.find((r) => r.id === row.rule_id);
}

export function relationSummary(row: PlanningRelationRow): string {
  const def = relationDefinition(row);
  const base = def?.label_tr ?? row.rule_id;
  const subj = row.subject_labels.length ? row.subject_labels.join(', ') : '—';
  const sec =
    row.sections_mode === 'all' ? 'Tüm sınıflar' : row.sections.length ? row.sections.join(', ') : 'Seçim yok';
  const imp = row.importance === 'strict' ? 'Zorunlu' : row.importance === 'low' ? 'Düşük' : 'Normal';
  return `${base} · ${subj} · ${sec} · ${imp}`;
}
