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
  not_consecutive_same_hour: 'Aynı gün bitişik saatte olamaz',
  max_days_per_week_planning: 'Haftada en fazla ders günü',
  max_same_period_week: 'Haftada aynı saatte en fazla X gün',
  no_compact_week: 'Haftaya yayılım (müfredat hızı)',
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

/** Stüdyo workflow_status (DB anahtarı → Türkçe) */
export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  setup: 'Kurulum',
  collecting_prefs: 'Müsaitlik toplanıyor',
  ready: 'Üretime hazır',
  generating: 'Program üretiliyor',
  generated: 'Program üretildi',
  council_review: 'Kurul incelemesi',
  published: 'Yayında',
  draft: 'Taslak',
  reviewing: 'İnceleniyor',
};

/** Öğretmen müsaitlik başvurusu */
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Onay bekliyor',
  approved: 'Tam onaylandı',
  partially_approved: 'Kısmen onaylandı',
  rejected: 'Reddedildi',
};

/** Program kaydı durumu */
export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  generated: 'Üretildi',
  published: 'Yayında',
  archived: 'Arşiv',
  active: 'Aktif',
};

function isTechnicalKey(value: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/i.test(value.trim());
}

function fallbackReadable(value: string): string {
  if (!isTechnicalKey(value)) return value;
  return 'Durum bilgisi';
}

export function workflowStatusLabel(status: string | null | undefined): string {
  const k = status?.trim();
  if (!k) return 'Belirtilmedi';
  return WORKFLOW_STATUS_LABELS[k] ?? fallbackReadable(k);
}

export function submissionStatusLabel(status: string | null | undefined): string {
  const k = status?.trim();
  if (!k) return '—';
  return SUBMISSION_STATUS_LABELS[k] ?? fallbackReadable(k);
}

export function programStatusLabel(status: string | null | undefined): string {
  const k = status?.trim();
  if (!k) return '—';
  return PROGRAM_STATUS_LABELS[k] ?? fallbackReadable(k);
}
