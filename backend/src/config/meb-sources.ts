/**
 * MEB resmi kaynak URL'leri – API otomasyonu için.
 * Kaynak: https://tymm.meb.gov.tr/taslak-cerceve-planlari
 */

/** Subject code normalizasyonu: cografya_maarif_fl -> cografya */
export function normalizeSubjectCodeForMeb(subjectCode: string): string {
  return (subjectCode ?? '')
    .toLowerCase()
    .trim()
    .replace(/_maarif.*$/, '');
}

/** TYMM taslak plan RAR – Ortaöğretim (9-12) */
export const TYMM_ORTAOGRETIM_URLS: Record<string, string> = {
  cografya: 'https://tymm.meb.gov.tr/upload/plan/cografya_dersi_taslak_plani.rar',
  matematik: 'https://tymm.meb.gov.tr/upload/plan/matematik_dersi_taslak_plani.rar',
  tarih: 'https://tymm.meb.gov.tr/upload/plan/tarih_dersi_taslak_plani.rar',
  fizik: 'https://tymm.meb.gov.tr/upload/plan/fizik_dersi_taslak_plani.rar',
  kimya: 'https://tymm.meb.gov.tr/upload/plan/kimya_dersi_taslak_plani.rar',
  biyoloji: 'https://tymm.meb.gov.tr/upload/plan/biyoloji_dersi_taslak_plani.rar',
  turk_dili_edebiyati: 'https://tymm.meb.gov.tr/upload/plan/turk_dili_ve_edebiyati_taslak_plani.rar',
  ingilizce: 'https://tymm.meb.gov.tr/upload/plan/ingilizce_dersi_taslak_plani.rar',
  felsefe: 'https://tymm.meb.gov.tr/upload/plan/felsefe_dersi_taslak_plani.rar',
  gorsel_sanatlar: 'https://tymm.meb.gov.tr/upload/plan/gorsel_sanatlar_dersi_taslak_plani.rar',
  muzik: 'https://tymm.meb.gov.tr/upload/plan/muzik_dersi_taslak_plani.rar',
  beden_egitimi_spor: 'https://tymm.meb.gov.tr/upload/plan/beden_egitimi_ve_spor_dersi_taslak_plani.rar',
  beden_egitimi: 'https://tymm.meb.gov.tr/upload/plan/beden_egitimi_ve_spor_dersi_taslak_plani.rar',
};

/** TYMM taslak plan RAR – Temel Eğitim (1-8). Kaynak: tymm.meb.gov.tr/taslak-cerceve-planlari */
export const TYMM_TEMEL_EGITIM_URLS: Record<string, string> = {
  fen_bilimleri: 'https://tymm.meb.gov.tr/upload/plan/fen_bilimleri_taslak_plani.rar',
  hayat_bilgisi: 'https://tymm.meb.gov.tr/upload/plan/hayat_bilgisi_taslak_plani.rar',
  ilkokul_matematik: 'https://tymm.meb.gov.tr/upload/plan/ilkokul_matematik_taslak_plani.rar',
  ilkokul_turkce: 'https://tymm.meb.gov.tr/upload/plan/ilkokul_turkce_taslak_plani.rar',
  ortaokul_matematik: 'https://tymm.meb.gov.tr/upload/plan/ortaokul_matematik_taslak_plani.rar',
  ortaokul_turkce: 'https://tymm.meb.gov.tr/upload/plan/ortaokul_turkce_taslak_plani.rar',
  sosyal_bilgiler: 'https://tymm.meb.gov.tr/upload/plan/sosyal_bilgiler_taslak_plani.rar',
  ingilizce: 'https://tymm.meb.gov.tr/upload/plan/ingilizce_dersi_taslak_tegm_plani.rar',
  bilisim_teknolojileri: 'https://tymm.meb.gov.tr/upload/plan/bilisim_teknolojileri_dersi_taslak_plan.rar',
  beden_egitimi_oyun: 'https://tymm.meb.gov.tr/upload/plan/beden_egitimi_oyun_dersi_taslak_plan.rar',
  beden_egitimi_spor: 'https://tymm.meb.gov.tr/upload/plan/beden_egitimi_spor_dersi_taslak_plan.rar',
  muzik: 'https://tymm.meb.gov.tr/upload/plan/muzik_dersi_taslak_plan.rar',
  gorsel_sanatlar: 'https://tymm.meb.gov.tr/upload/plan/gorsel-sanatlar-dersi-temel-egitim-taslak-plan.rar',
  almanca: 'https://tymm.meb.gov.tr/upload/plan/almanca_dersi_taslak_plan.rar',
  tc_inkilap: 'https://tymm.meb.gov.tr/upload/plan/inkilap_tarihi_ataturkculuk_taslak_plani.rar',
};

/** Tüm TYMM URL'leri (geriye uyumluluk – mevcut MEB import için) */
export const TYMM_TASLAK_PLAN_URLS: Record<string, string> = {
  ...TYMM_ORTAOGRETIM_URLS,
};

/**
 * Ders kodu + sınıf -> TYMM Temel Eğitim URL.
 * Temel Eğitim (1-8) için subject_code eşlemesi.
 */
export function getTymmTemelEgitimUrl(subjectCode: string, grade: number): string | null {
  const lower = (subjectCode ?? '').toLowerCase().trim();
  const base = normalizeSubjectCodeForMeb(lower);

  if (grade >= 1 && grade <= 4) {
    const map: Record<string, string> = {
      matematik: 'ilkokul_matematik',
      turkce: 'ilkokul_turkce',
      hayat_bilgisi: 'hayat_bilgisi',
      fen_bilimleri: 'fen_bilimleri',
      sosyal_bilgiler: 'sosyal_bilgiler',
      muzik: 'muzik',
      gorsel_sanatlar: 'gorsel_sanatlar',
      beden_egitimi_oyun: 'beden_egitimi_oyun',
      beden_egitimi: 'beden_egitimi_oyun',
      ingilizce: 'ingilizce',
      bil_tek_yazilim: 'bilisim_teknolojileri',
    };
    const tymmCode = map[base];
    return tymmCode && tymmCode in TYMM_TEMEL_EGITIM_URLS ? TYMM_TEMEL_EGITIM_URLS[tymmCode] : null;
  }
  if (grade >= 5 && grade <= 8) {
    const map: Record<string, string> = {
      matematik: 'ortaokul_matematik',
      turkce: 'ortaokul_turkce',
      fen_bilimleri: 'fen_bilimleri',
      sosyal_bilgiler: 'sosyal_bilgiler',
      ingilizce: 'ingilizce',
      muzik: 'muzik',
      gorsel_sanatlar: 'gorsel_sanatlar',
      beden_egitimi: 'beden_egitimi_spor',
      bil_tek_yazilim: 'bilisim_teknolojileri',
      tc_inkilap: 'tc_inkilap',
      almanca: 'almanca',
    };
    const tymmCode = map[base];
    return tymmCode && tymmCode in TYMM_TEMEL_EGITIM_URLS ? TYMM_TEMEL_EGITIM_URLS[tymmCode] : null;
  }
  return null;
}

/** Sınıfa göre MEB taslak planı bulunan ders kodları (document catalog ile uyumlu) */
export function getTymmAvailableSubjectCodes(grade?: number): string[] {
  if (grade != null && grade >= 1 && grade <= 4) {
    return [
      'matematik', 'turkce', 'hayat_bilgisi', 'fen_bilimleri', 'sosyal_bilgiler',
      'muzik', 'gorsel_sanatlar', 'beden_egitimi_oyun', 'beden_egitimi', 'ingilizce', 'bil_tek_yazilim',
    ];
  }
  if (grade != null && grade >= 5 && grade <= 8) {
    return [
      'matematik', 'turkce', 'fen_bilimleri', 'sosyal_bilgiler', 'ingilizce',
      'muzik', 'gorsel_sanatlar', 'beden_egitimi', 'bil_tek_yazilim', 'tc_inkilap', 'almanca',
    ];
  }
  if (grade != null && grade >= 9 && grade <= 12) {
    return Object.keys(TYMM_ORTAOGRETIM_URLS);
  }
  const temel = new Set([
    'matematik', 'turkce', 'hayat_bilgisi', 'fen_bilimleri', 'sosyal_bilgiler',
    'muzik', 'gorsel_sanatlar', 'beden_egitimi_oyun', 'beden_egitimi', 'ingilizce',
    'bil_tek_yazilim', 'tc_inkilap', 'almanca',
  ]);
  const orta = Object.keys(TYMM_ORTAOGRETIM_URLS);
  return [...new Set([...temel, ...orta])];
}

/** subject_code + grade -> TYMM RAR URL (Temel Eğitim veya Ortaöğretim) */
export function getTymmFetchUrl(subjectCode: string, grade: number): string | null {
  if (grade >= 1 && grade <= 8) {
    return getTymmTemelEgitimUrl(subjectCode, grade);
  }
  if (grade >= 9 && grade <= 12) {
    const lower = (subjectCode ?? '').toLowerCase().trim();
    if (lower in TYMM_ORTAOGRETIM_URLS) return TYMM_ORTAOGRETIM_URLS[lower];
    const base = normalizeSubjectCodeForMeb(lower);
    return base in TYMM_ORTAOGRETIM_URLS ? TYMM_ORTAOGRETIM_URLS[base] : null;
  }
  return null;
}

/** Ders + sınıf için MEB TYMM kaynak sayfa URL'leri (GPT'e veri kaynağı olarak) */
export function getTymmSourceUrls(subjectCode: string, grade: number): {
  taslakPlanPage: string;
  programPage: string;
  taslakRarUrl: string | null;
} {
  const taslakPlanPage = 'https://tymm.meb.gov.tr/taslak-cerceve-planlari';
  const programPage =
    grade >= 1 && grade <= 8
      ? 'https://tymm.meb.gov.tr/ogretim-programlari/temel-egitim'
      : 'https://tymm.meb.gov.tr/ogretim-programlari/ortaogretim';
  const taslakRarUrl = getTymmFetchUrl(subjectCode, grade);
  return { taslakPlanPage, programPage, taslakRarUrl };
}

/** mufredat.meb.gov.tr ProgramDetay PID – ders kodu -> PID */
export const MUFREDAT_PID: Record<string, number> = {
  cografya: 1984,
  matematik: 1991,
  tarih: 1993,
  fizik: 1987,
  kimya: 1989,
  biyoloji: 1983,
  turk_dili_edebiyati: 1994,
  din_kulturu: 1985,
  ingilizce: 1906,
  felsefe: 1986,
};

/** Ders kodu -> MEB ders etiketi */
export const SUBJECT_LABELS: Record<string, string> = {
  cografya: 'Coğrafya',
  matematik: 'Matematik',
  turkce: 'Türkçe',
  hayat_bilgisi: 'Hayat Bilgisi',
  fen_bilimleri: 'Fen Bilimleri',
  sosyal_bilgiler: 'Sosyal Bilgiler',
  bil_tek_yazilim: 'Bilişim Teknolojileri',
  tc_inkilap: 'T.C. İnkılap Tarihi ve Atatürkçülük',
  almanca: 'Almanca',
  beden_egitimi_oyun: 'Beden Eğitimi ve Oyun',
  tarih: 'Tarih',
  fizik: 'Fizik',
  kimya: 'Kimya',
  biyoloji: 'Biyoloji',
  turk_dili_edebiyati: 'Türk Dili ve Edebiyatı',
  ingilizce: 'İngilizce',
  felsefe: 'Felsefe',
  din_kulturu: 'Din Kültürü ve Ahlak Bilgisi',
  gorsel_sanatlar: 'Görsel Sanatlar',
  muzik: 'Müzik',
  beden_egitimi_spor: 'Beden Eğitimi ve Spor',
  beden_egitimi: 'Beden Eğitimi ve Spor',
};
