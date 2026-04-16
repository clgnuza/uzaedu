/**
 * Okul `enabled_modules`, market politikası ve backend `MARKET_MODULE_KEYS` ile aynı anahtarlar.
 * @see backend/src/app-config/market-policy.defaults.ts
 */
export const SCHOOL_MODULE_KEYS = [
  'duty',
  'tv',
  'extra_lesson',
  'document',
  'outcome',
  'optical',
  'smart_board',
  'teacher_agenda',
  'bilsem',
  'school_profile',
  'school_reviews',
  'butterfly_exam',
  'sorumluluk_sinav',
  'messaging',
] as const;

export type SchoolModuleKey = (typeof SCHOOL_MODULE_KEYS)[number];

/** Okul düzenleme sayfası (MODULE_OPTIONS) ile uyumlu isimler */
export const SCHOOL_MODULE_LABELS: Record<SchoolModuleKey, string> = {
  duty: 'Nöbet',
  tv: 'Duyuru TV',
  extra_lesson: 'Ek Ders',
  document: 'Evrak & Plan',
  outcome: 'Kazanım Cebimde',
  optical: 'Optik Okuma',
  smart_board: 'Akıllı Tahta',
  teacher_agenda: 'Öğretmen Ajandası',
  bilsem: 'Bilsem',
  school_profile: 'Okul Tanıtım',
  school_reviews: 'Okul Değerlendirme',
  butterfly_exam: 'Kertenkele Sınav',
  sorumluluk_sinav: 'Sorumluluk / Beceri Sınavı',
  messaging: 'Mesaj Gönderme Merkezi',
};

/** Market sayfası: modül hücresi için kısa bağlam (hover) */
export const SCHOOL_MODULE_MARKET_HINTS: Record<SchoolModuleKey, string> = {
  duty: 'Nöbet planı ve nöbetçi süreçleri; çoğunlukla okul yönetimi tarafından yürütülür.',
  tv: 'Okul içi duyuru TV içerikleri ve cihazlar.',
  extra_lesson: 'Ek ders hesaplama ve ilgili parametreler.',
  document: 'Evrak şablonları, plan ve belge üretimi.',
  outcome: 'Kazanım takip ve yıllık plan içerikleri.',
  optical: 'Optik formlar ve optik okuma.',
  smart_board: 'Akıllı tahta oturumları ve cihaz yönetimi.',
  teacher_agenda: 'Öğretmen ajandası ve değerlendirme.',
  bilsem: 'Bilsem takvim ve yıllık plan.',
  school_profile: 'Okul tanıtım sayfası ve vitrin içeriği.',
  school_reviews: 'Veli/öğrenci okul değerlendirmeleri ve raporlar.',
  butterfly_exam: 'Ortak sınavlarda kelebek yerleştirme, salon ve koltuk planı.',
  sorumluluk_sinav: 'Sorumluluk ve beceri sınavları programlama, görevlendirme ve raporlar.',
  messaging: 'WhatsApp mesaj gönderme: veli, öğretmen, ek ders, maaş, devamsızlık, karne dağıtımı.',
};

export const SCHOOL_MODULE_OPTIONS = SCHOOL_MODULE_KEYS.map((key) => ({
  key,
  label: SCHOOL_MODULE_LABELS[key],
}));
