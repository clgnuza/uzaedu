/** MEB + okul kural şablonları — DersDağıt */

export type DersDagitRuleKind = 'hard' | 'soft' | 'pedagogy';

export type DersDagitRuleDef = {
  key: string;
  label_tr: string;
  kind: DersDagitRuleKind;
  default_active: boolean;
  default_weight?: number;
};

export const DERS_DAGIT_RULE_CATALOG: DersDagitRuleDef[] = [
  { key: 'no_teacher_clash', label_tr: 'Öğretmen aynı saatte iki yerde olamaz', kind: 'hard', default_active: true },
  { key: 'no_class_clash', label_tr: 'Sınıf aynı saatte iki derste olamaz', kind: 'hard', default_active: true },
  { key: 'class_weekly_capacity', label_tr: 'Sınıfın haftalık ders saati dolmalı', kind: 'hard', default_active: true },
  { key: 'teacher_weekly_hours', label_tr: 'Öğretmenin haftalık ders limiti', kind: 'hard', default_active: true },
  { key: 'room_required', label_tr: 'Her dersin dersliği olmalı', kind: 'hard', default_active: false },
  { key: 'fixed_slots', label_tr: 'Önceden belirlenen saatler değişmez', kind: 'hard', default_active: true },
  { key: 'group_parallel_same_slot', label_tr: 'Bölünmüş sınıflar aynı saatte', kind: 'hard', default_active: true },
  { key: 'building_travel_time', label_tr: 'Binalar arası geçiş süresi', kind: 'hard', default_active: false },
  { key: 'no_building_same_day', label_tr: 'Aynı gün farklı binada ders yok', kind: 'hard', default_active: false },
  { key: 'distribute_week', label_tr: 'Dersler haftaya yayılır', kind: 'soft', default_active: true, default_weight: 10 },
  { key: 'two_same_day', label_tr: 'Haftada 2 saat — aynı günde', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'max_one_per_day', label_tr: 'Günde en fazla 1 saat aynı ders', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'max_two_per_day', label_tr: 'Günde en fazla 2 saat aynı ders', kind: 'soft', default_active: true, default_weight: 10 },
  { key: 'min_two_per_day', label_tr: 'Günde en az 2 saat (ardışık tercih)', kind: 'soft', default_active: false, default_weight: 6 },
  { key: 'two_not_consecutive_days', label_tr: 'Haftada 2 saat — ardışık günlerde değil', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'two_not_same_day', label_tr: 'Haftada 2 saat — farklı günlerde', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'two_two_day_gap', label_tr: 'Haftada 2 saat — arada 1 gün boşluk', kind: 'soft', default_active: false, default_weight: 7 },
  { key: 'same_day_consecutive', label_tr: 'Aynı gün ardışık saatlerde', kind: 'soft', default_active: true, default_weight: 8 },
  { key: 'four_plus_consecutive', label_tr: 'Günde 4 saatten fazla ardışık ders yok', kind: 'soft', default_active: false, default_weight: 5 },
  { key: 'important_early', label_tr: 'Önemli dersler günün erken saatlerinde', kind: 'soft', default_active: true, default_weight: 6 },
  { key: 'minimize_teacher_gaps', label_tr: 'Öğretmenin boş saatleri az', kind: 'soft', default_active: true, default_weight: 12 },
  { key: 'minimize_work_days', label_tr: 'Öğretmenin geldiği gün sayısı az', kind: 'soft', default_active: false, default_weight: 8 },
  { key: 'minimize_building_moves', label_tr: 'Bina değiştirme az', kind: 'soft', default_active: false, default_weight: 6 },
  {
    key: 'meb_pe_music_days',
    label_tr: 'Beden ve müzik belirli günlerde',
    kind: 'pedagogy',
    default_active: true,
    default_weight: 5,
  },
  {
    key: 'meb_theory_am_practical_pm',
    label_tr: 'Teorik sabah, uygulamalı öğleden sonra',
    kind: 'pedagogy',
    default_active: true,
    default_weight: 6,
  },
];

/** Varsayılan beden/müzik günleri (Sal=2, Per=4). */
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
