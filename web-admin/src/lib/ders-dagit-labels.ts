/** DersDağıt arayüzünde anlaşılır Türkçe terimler */

export const DD_STUDIO_NAME = 'Program merkezi';

export const RULE_KIND_UI: Record<
  'hard' | 'soft' | 'pedagogy',
  { title: string; hint: string }
> = {
  hard: {
    title: 'Zorunlu kurallar',
    hint: 'İhlal edilirse otomatik program oluşturulamaz.',
  },
  soft: {
    title: 'Tercih kuralları',
    hint: 'Öncelik puanıyla mümkün olduğunca uygulanır.',
  },
  pedagogy: {
    title: 'MEB program kuralları',
    hint: 'Beden, müzik ve ders türüne göre yerleşim.',
  },
};

/** API anahtarı → kullanıcıya gösterilen kısa açıklama */
export const RULE_LABELS: Record<string, string> = {
  no_teacher_clash: 'Öğretmen aynı saatte iki yerde olamaz',
  no_class_clash: 'Sınıf aynı saatte iki derste olamaz',
  class_weekly_capacity: 'Sınıfın haftalık ders saati dolmalı',
  teacher_weekly_hours: 'Öğretmenin haftalık ders limiti',
  room_required: 'Her dersin dersliği olmalı',
  fixed_slots: 'Önceden belirlenen saatler değişmez',
  group_parallel_same_slot: 'Bölünmüş sınıflar aynı saatte',
  building_travel_time: 'Binalar arası geçiş süresi',
  no_building_same_day: 'Aynı gün farklı binada ders yok',
  distribute_week: 'Dersler haftaya yayılır',
  two_same_day: 'Haftada 2 saat — aynı günde',
  max_one_per_day: 'Günde en fazla 1 saat aynı ders',
  max_two_per_day: 'Günde en fazla 2 saat aynı ders',
  min_two_per_day: 'Günde en az 2 saat (ardışık tercih)',
  two_not_consecutive_days: 'Haftada 2 saat — ardışık günlerde değil',
  two_not_same_day: 'Haftada 2 saat — farklı günlerde',
  two_two_day_gap: 'Haftada 2 saat — arada 1 gün boşluk',
  same_day_consecutive: 'Aynı gün ardışık saatlerde',
  four_plus_consecutive: 'Günde 4 saatten fazla ardışık ders yok',
  important_early: 'Önemli dersler günün erken saatlerinde',
  minimize_teacher_gaps: 'Öğretmenin boş saatleri az',
  minimize_work_days: 'Öğretmenin geldiği gün sayısı az',
  minimize_building_moves: 'Bina değiştirme az',
  meb_pe_music_days: 'Beden ve müzik belirli günlerde',
  meb_theory_am_practical_pm: 'Teorik sabah, uygulamalı öğleden sonra',
};

export function ruleLabel(key: string, fallback: string): string {
  return RULE_LABELS[key] ?? fallback;
}

export const GROUP_MODE_LABELS: Record<string, string> = {
  parallel_rooms: 'Aynı anda farklı odalarda',
  subgroups: 'Alt şubeler',
  teacher_multi_class: 'Öğretmen birden fazla sınıfta',
  parallel: 'Paralel',
};

export function groupModeLabel(mode: string | null | undefined): string {
  if (!mode) return '—';
  return GROUP_MODE_LABELS[mode] ?? mode;
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

export function dayLabel(day: number): string {
  return DAY_NAMES[day] ?? `Gün ${day}`;
}
