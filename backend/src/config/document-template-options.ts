/**
 * DocumentTemplate sub_type ve school_type seçenekleri – tür bazlı.
 * Kaynak: EVRAK_PLANLAR_ANALIZ.md, EVRAK_ENTEGRASYON_ANALIZ.md.
 */
export interface OptionEntry {
  value: string;
  label: string;
}

/** Zümre alt türleri */
export const ZUMRE_SUB_TYPES: OptionEntry[] = [
  { value: 'sene_basi', label: 'Sene Başı' },
  { value: 'sene_sonu', label: 'Sene Sonu' },
  { value: 'birinci_donem_ara', label: 'Birinci Dönem Ara' },
  { value: 'ikinci_donem_basi', label: 'İkinci Dönem Başı' },
  { value: 'ikinci_donem_ara', label: 'İkinci Dönem Ara' },
  { value: 'eski_zumre', label: 'Eski Zümreler' },
];

/** Okul türleri (zümre ve bazı evraklar için) */
export const SCHOOL_TYPES: OptionEntry[] = [
  { value: 'anaokul', label: 'Anaokulu' },
  { value: 'ilkokul', label: 'İlkokul' },
  { value: 'ortaokul', label: 'Ortaokul' },
  { value: 'temel_egitim', label: 'Temel Eğitim Okulu (1–8)' },
  { value: 'lise', label: 'Lise (genel)' },
  { value: 'anadolu_lisesi', label: 'Anadolu Lisesi' },
  { value: 'cok_programli_anadolu_lisesi', label: 'Çok Programlı Anadolu Lisesi' },
  { value: 'fen_lisesi', label: 'Fen Lisesi' },
  { value: 'sosyal_bilimler_lisesi', label: 'Sosyal Bilimler Lisesi' },
  { value: 'meslek_lisesi', label: 'Meslek Lisesi / MTAL' },
  { value: 'guzel_sanatlar_lisesi', label: 'Güzel Sanatlar Lisesi' },
  { value: 'spor_lisesi', label: 'Spor Lisesi' },
  { value: 'acik_ogretim_lisesi', label: 'Açık Öğretim Lisesi' },
  { value: 'imam_hatip_ortaokul', label: 'İmam Hatip Ortaokulu' },
  { value: 'imam_hatip_lise', label: 'İmam Hatip Lisesi' },
  { value: 'ozel_egitim', label: 'Özel Eğitim Uygulama Okulu' },
  { value: 'halk_egitim', label: 'Halk Eğitim Merkezi' },
  { value: 'bilsem', label: 'BİLSEM' },
  { value: 'okul_oncesi', label: 'Okul Öncesi (evrak)' },
  { value: 'mesem', label: 'Mesem' },
  { value: 'ortaokul_secmeli', label: 'Ortaokul Seçmeli' },
  { value: 'lise_secmeli', label: 'Lise Seçmeli' },
];

/** İYEP plan alt türleri */
export const IYEP_SUB_TYPES: OptionEntry[] = [
  { value: 'turkce', label: 'Türkçe' },
  { value: 'matematik', label: 'Matematik' },
];

/** BEP plan alt türleri */
export const BEP_SUB_TYPES: OptionEntry[] = [
  { value: 'dosya', label: 'BEP Dosyası (Yeni)' },
  { value: 'plan_yeni', label: 'BEP Planı (Yeni)' },
  { value: 'plan_eski', label: 'BEP Planı (Eski)' },
  { value: 'kaba_form', label: 'BEP Kaba Formları' },
];

/** Bölüm seçenekleri (planlar için) */
export const SECTIONS: OptionEntry[] = [
  { value: 'ders', label: 'Ders' },
  { value: 'secmeli', label: 'Seçmeli' },
  { value: 'iho', label: 'İHO' },
];

/** Plan türleri */
export const PLAN_TYPES = [
  'yillik_plan',
  'gunluk_plan',
  'egzersiz_plan',
  'iyep_plan',
  'bep_plan',
] as const;

/** Zümre dışı evrak türleri */
export const OTHER_TYPES = [
  'zumre',
  'kulup_evrak',
  'veli_toplanti_tutanak',
  'aday_ogretmen_dosyasi',
  'rehberlik_raporu',
  'dilekce',
  'diger',
] as const;

export function getSubTypeOptions(type: string): OptionEntry[] {
  switch (type) {
    case 'zumre':
      return ZUMRE_SUB_TYPES;
    case 'iyep_plan':
      return IYEP_SUB_TYPES;
    case 'bep_plan':
      return BEP_SUB_TYPES;
    default:
      return [];
  }
}

/** Son 5 öğretim yılı */
export function getAcademicYearOptions(): string[] {
  const years: string[] = [];
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = 0; i < 5; i++) {
    const y = startYear - i;
    years.push(`${y}-${y + 1}`);
  }
  return years;
}
