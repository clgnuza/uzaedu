/** Planlama kuralı — madde listesi metinleri (özgün, picker + özet). */

export type PlanningRuleListTone = 'slot' | 'week' | 'cards' | 'teacher' | 'group' | 'pedagogy';

export type PlanningRuleListCopy = {
  lead: string;
  detail: string;
  tone: PlanningRuleListTone;
  emoji: string;
};

const TONE_EMOJI: Record<PlanningRuleListTone, string> = {
  slot: '⏰',
  week: '📅',
  cards: '📚',
  teacher: '👩‍🏫',
  group: '👥',
  pedagogy: '🎓',
};

const SIMPLE: Record<string, PlanningRuleListCopy> = {
  not_same_day: {
    emoji: '📆',
    lead: 'Günleri ayır',
    detail: 'Seçili dersin saatleri haftada farklı günlere serpiştirilir; tek güne yığılmaz.',
    tone: 'week',
  },
  not_consecutive_same_day: {
    emoji: '⏱️',
    lead: 'Bitişik saatleri kapat',
    detail: 'Aynı gün içinde ardışık ders sırası kullanılmaz; araya boş dilim kalır.',
    tone: 'slot',
  },
  distribute_week: {
    emoji: '📚',
    lead: 'Haftaya nefes ver',
    detail: 'Çok saatli dersler mümkün olduğunca çeşitli günlere yayılır.',
    tone: 'week',
  },
  single_day: {
    emoji: '📌',
    lead: 'Tek güne topla',
    detail: 'Haftalık saatler tercihen aynı günde, blok halinde tutulur.',
    tone: 'week',
  },
  consecutive: {
    emoji: '🔗',
    lead: 'Ardışık slot zorunlu',
    detail: 'Aynı gündeki saatler bitişik dilimlerde yer alır; dağınık saat bırakılmaz.',
    tone: 'slot',
  },
  parallel_start: {
    emoji: '👥',
    lead: 'Grup aynı anda',
    detail: 'Bölünmüş şubeler veya grup dersleri aynı saat diliminde başlar.',
    tone: 'group',
  },
  first_or_last_period: {
    emoji: '⭐',
    lead: 'Günün kenarına al',
    detail: 'Önemli dersler sabahın erken veya gün sonu dilimlerine çekilir.',
    tone: 'pedagogy',
  },
  max_consecutive: {
    emoji: '📊',
    lead: 'Uzun blok sınırı',
    detail: 'Günde üst üste en fazla belirttiğiniz kadar kesintisiz saat oluşur.',
    tone: 'slot',
  },
  max_per_day: {
    emoji: '✏️',
    lead: 'Günlük tavan',
    detail: 'Bir günde aynı dersten fazla saat konmaz; fazlası başka güne kayar.',
    tone: 'week',
  },
  minimize_gaps: {
    emoji: '☕',
    lead: 'Öğretmene pencere bırakma',
    detail: 'Gün içi boş ders saatleri azaltılır; servis ve yorgunluk düşer.',
    tone: 'teacher',
  },
};

const ADVANCED: Record<string, PlanningRuleListCopy> = {
  adv_same_hour: {
    emoji: '⏰',
    lead: 'Aynı çizgide çakışma yok',
    detail: 'Seçtiğiniz ders kartları aynı gün ve saatte üst üste binmez.',
    tone: 'cards',
  },
  adv_same_day: {
    emoji: '📅',
    lead: 'Kartlar farklı günlerde',
    detail: 'İlişkili dersler aynı takvim gününe konmaz; hafta içine yayılır.',
    tone: 'cards',
  },
  adv_must_same_day: {
    emoji: '🤝',
    lead: 'Kartlar tek günde',
    detail: 'İlişkili dersler aynı gün içinde toplanır; blok veya yakın saat mantığı.',
    tone: 'cards',
  },
  adv_not_consecutive_same_day: {
    emoji: '↔️',
    lead: 'Yan yana saat yasak',
    detail: 'Aynı günde bitişik dilimler kullanılmaz; kartlar arası nefes bırakılır.',
    tone: 'slot',
  },
  adv_max_gap: {
    emoji: '🪟',
    lead: 'Boşluk tavanı',
    detail: 'Öğretmenin gün içindeki boş ders sayısı belirttiğiniz üst sınırı aşmaz.',
    tone: 'teacher',
  },
  adv_max_consecutive: {
    emoji: '📏',
    lead: 'Kesintisiz seri sınırı',
    detail: 'Günde art arda en fazla belirttiğiniz kadar ders saati dizilir.',
    tone: 'slot',
  },
  adv_min_gap_days: {
    emoji: '🛤️',
    lead: 'Günler arası mesafe',
    detail: 'İki ders günü arasında en az belirttiğiniz kadar boş gün kalır.',
    tone: 'week',
  },
  adv_max_days_week: {
    emoji: '🗓️',
    lead: 'Haftalık gün kotası',
    detail: 'Ders en fazla belirttiğiniz sayıda farklı günde görünür; fazla gün kapatılır.',
    tone: 'week',
  },
  adv_max_per_day: {
    emoji: '📕',
    lead: 'Günde saat limiti',
    detail: 'Seçili kartlar için günlük ders saati tavanı uygulanır.',
    tone: 'week',
  },
  adv_max_same_period: {
    emoji: '🕐',
    lead: 'Aynı saat tekrarı',
    detail: 'Örneğin hep 2. saatte olma alışkanlığı sınırlanır; haftada en fazla X gün.',
    tone: 'slot',
  },
  adv_parallel_start: {
    emoji: '🧑‍🤝‍🧑',
    lead: 'Eşzamanlı başlangıç',
    detail: 'Grup veya bölünmüş sınıf kartları aynı anda açılır.',
    tone: 'group',
  },
  adv_a_before_b_week: {
    emoji: '🔢',
    lead: 'Haftalık sıra: önce A',
    detail: 'İlk seçtiğiniz dersin tüm saatleri, ikinci dersin saatlerinden önce gelir.',
    tone: 'cards',
  },
  adv_fixed_hours: {
    emoji: '🔒',
    lead: 'Sabit çizelge',
    detail: 'Yalnız atamada tanımlı saatler kullanılır; üretim bu slotları oynatmaz.',
    tone: 'slot',
  },
  adv_no_start_hour: {
    emoji: '🌅',
    lead: 'Başlangıç yasak dilimleri',
    detail: 'İşaretlediğiniz saatlerde ders başlamaz; öğle, toplantı veya geçiş için uygundur.',
    tone: 'slot',
  },
  adv_no_end_hour: {
    emoji: '🌇',
    lead: 'Bitiş yasak dilimleri',
    detail: 'İşaretlediğiniz saatlerde ders bloğu sona eremez; gün kapanışı korunur.',
    tone: 'slot',
  },
  adv_faster_than_curriculum: {
    emoji: '🌿',
    lead: 'Sıkıştırma freni',
    detail: 'Haftalık saatler az sayıda güne yığılmaz; müfredat temposuna uygun yayılım.',
    tone: 'week',
  },
};

export function planningRuleListCopy(
  ruleId: string,
  kind: 'simple' | 'advanced',
): PlanningRuleListCopy | undefined {
  return kind === 'simple' ? SIMPLE[ruleId] : ADVANCED[ruleId];
}

export function planningRuleEmoji(ruleId: string, kind: 'simple' | 'advanced'): string {
  const copy = planningRuleListCopy(ruleId, kind);
  if (copy?.emoji) return copy.emoji;
  if (copy?.tone) return TONE_EMOJI[copy.tone];
  return '📖';
}

export const PLANNING_LESSON_SLOT_RULE_IDS = new Set(['adv_no_start_hour', 'adv_no_end_hour']);

export function ruleUsesLessonSlotList(ruleId: string): boolean {
  return PLANNING_LESSON_SLOT_RULE_IDS.has(ruleId);
}

/** Gün içi ders sırası — madde listesi etiketleri (#32 / #33). */
export const PLANNING_LESSON_SLOT_ITEMS: Array<{ num: number; label: string; hint: string }> = [
  { num: 1, label: 'Gün açılışı', hint: 'Genelde sabah ilk ders dilimi' },
  { num: 2, label: 'Sabah orta', hint: 'Yoğun dersler için uygun dilim' },
  { num: 3, label: 'Sabah sonu', hint: 'Öğle öncesi geçiş' },
  { num: 4, label: 'Öğle hattı', hint: 'Öğle öncesi veya öğle sonrası başlangıç' },
  { num: 5, label: 'Öğleden sonra açılış', hint: 'İkinci yarım günün ilk dilimi' },
  { num: 6, label: 'Öğleden sonra orta', hint: 'İkinci yarım gün ortası' },
  { num: 7, label: 'Gün sonuna yakın', hint: 'Kapanış öncesi dilim' },
  { num: 8, label: 'Gün kapanışı', hint: 'Son ders dilimi' },
];

export function blockedLessonsFromParams(params?: Record<string, unknown>): number[] {
  const raw = params?.blocked_lessons;
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => n >= 1 && n <= 12);
  }
  const one = Number(params?.max);
  if (Number.isFinite(one) && one >= 1 && one <= 12) return [Math.floor(one)];
  return [];
}
