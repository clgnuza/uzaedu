/** Horarium + MEB kural şablonları — DersDağıt */

export type DersDagitRuleKind = 'hard' | 'soft' | 'pedagogy';

export type DersDagitRuleDef = {
  key: string;
  label_tr: string;
  kind: DersDagitRuleKind;
  default_active: boolean;
  default_weight?: number;
  horarium_ref?: string;
};

export const DERS_DAGIT_RULE_CATALOG: DersDagitRuleDef[] = [
  { key: 'no_teacher_clash', label_tr: 'Öğretmen çakışması yok', kind: 'hard', default_active: true },
  { key: 'no_class_clash', label_tr: 'Sınıf çakışması yok', kind: 'hard', default_active: true },
  { key: 'class_weekly_capacity', label_tr: 'Sınıf haftalık kapasite', kind: 'hard', default_active: true },
  { key: 'teacher_weekly_hours', label_tr: 'Öğretmen saat limitleri', kind: 'hard', default_active: true },
  { key: 'room_required', label_tr: 'Derslik zorunluluğu', kind: 'hard', default_active: false },
  { key: 'fixed_slots', label_tr: 'Sabit slotlar', kind: 'hard', default_active: true },
  { key: 'group_parallel_same_slot', label_tr: 'Grup paralel (aynı slot)', kind: 'hard', default_active: true, horarium_ref: 'divisions' },
  { key: 'building_travel_time', label_tr: 'Bina geçiş süresi', kind: 'hard', default_active: false },
  { key: 'no_building_same_day', label_tr: 'Aynı gün bina geçişi yok', kind: 'hard', default_active: false },
  { key: 'distribute_week', label_tr: 'Haftaya eşit dağıtım', kind: 'soft', default_active: true, default_weight: 10 },
  { key: 'two_same_day', label_tr: 'Haftada 2 — aynı gün', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'max_one_per_day', label_tr: 'Günde max 1 aynı ders', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'max_two_per_day', label_tr: 'Günde max 2 aynı ders', kind: 'soft', default_active: true, default_weight: 10 },
  { key: 'min_two_per_day', label_tr: 'Günde min 2 (ardışık tercih)', kind: 'soft', default_active: false, default_weight: 6 },
  { key: 'two_not_consecutive_days', label_tr: 'Haftada 2 — ardışık gün değil', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'two_not_same_day', label_tr: 'Haftada 2 — aynı gün değil', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'two_two_day_gap', label_tr: 'Haftada 2 — 2 gün arayla', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'same_day_consecutive', label_tr: 'Aynı gün ardışık aynı ders', kind: 'soft', default_active: true, default_weight: 8 },
  { key: 'four_plus_consecutive', label_tr: 'Günde 4+ ardışık', kind: 'soft', default_active: false, default_weight: 5 },
  { key: 'important_early', label_tr: 'Önemli dersler erken', kind: 'soft', default_active: true, default_weight: 6 },
  { key: 'minimize_teacher_gaps', label_tr: 'Öğretmen boşluk minimize', kind: 'soft', default_active: true, default_weight: 12 },
  { key: 'minimize_work_days', label_tr: 'Çalışma günü minimize', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'minimize_building_moves', label_tr: 'Bina geçişi minimize', kind: 'soft', default_active: false, default_weight: 6 },
  {
    key: 'meb_pe_music_days',
    label_tr: 'MEB: beden/müzik günü',
    kind: 'pedagogy',
    default_active: true,
    default_weight: 5,
    horarium_ref: 'meb',
  },
  {
    key: 'meb_theory_am_practical_pm',
    label_tr: 'MEB: teorik AM / uygulamalı PM',
    kind: 'pedagogy',
    default_active: true,
    default_weight: 6,
    horarium_ref: 'meb',
  },
];

/** Varsayılan MEB pedagoji günleri (Sal=2, Per=4). */
export const MEB_PE_MUSIC_DEFAULT_DAYS = [2, 4];

export function buildDefaultRuleState(): Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }> {
  const o: Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }> = {};
  for (const r of DERS_DAGIT_RULE_CATALOG) {
    o[r.key] = {
      active: r.default_active,
      weight: r.default_weight ?? (r.kind === 'soft' ? 5 : undefined),
      ...(r.key === 'meb_pe_music_days' ? { params: { days: [...MEB_PE_MUSIC_DEFAULT_DAYS] } } : {}),
    };
  }
  return o;
}
