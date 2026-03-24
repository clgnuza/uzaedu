/**
 * MEB Ders Kataloğu – sınıf ve bölüme göre ders listesi.
 * Kaynak: EVRAK_PLANLAR_ANALIZ.md, ogretmenevrak.com, MEB Maarif Modeli.
 */
export interface SubjectEntry {
  code: string;
  label: string;
}

/** 1. sınıf: sadece Ders bölümü */
export const GRADE_1_SUBJECTS: SubjectEntry[] = [
  { code: 'turkce_maarif', label: 'Türkçe - Maarif M.' },
  { code: 'serbest_etkinlik', label: 'Serbest Etkinlik' },
  { code: 'rehberlik', label: 'Rehberlik' },
  { code: 'muzik_maarif', label: 'Müzik - Maarif M.' },
  { code: 'matematik_maarif', label: 'Matematik - Maarif M.' },
  { code: 'hayat_bilgisi_maarif', label: 'Hayat Bilgisi - Maarif M.' },
  { code: 'gorsel_sanatlar_maarif', label: 'Görsel Sanatlar - Maarif M.' },
  { code: 'beden_egitimi_oyun_maarif', label: 'Beden Eğitimi ve Oyun - Maarif M.' },
];

/** 2–4. sınıf: Ders bölümü */
export const GRADE_2_4_SUBJECTS: SubjectEntry[] = [
  { code: 'turkce_maarif', label: 'Türkçe - Maarif M.' },
  { code: 'matematik_maarif', label: 'Matematik - Maarif M.' },
  { code: 'hayat_bilgisi_maarif', label: 'Hayat Bilgisi - Maarif M.' },
  { code: 'fen_bilimleri_maarif', label: 'Fen Bilimleri - Maarif M.' },
  { code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler' },
  { code: 'muzik_maarif', label: 'Müzik - Maarif M.' },
  { code: 'gorsel_sanatlar_maarif', label: 'Görsel Sanatlar - Maarif M.' },
  { code: 'beden_egitimi_maarif', label: 'Beden Eğitimi ve Spor - Maarif M.' },
  { code: 'ingilizce', label: 'İngilizce' },
  { code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi' },
  { code: 'serbest_etkinlik', label: 'Serbest Etkinlik' },
  { code: 'rehberlik', label: 'Rehberlik' },
  { code: 'bil_tek_yazilim', label: 'Bil. Tek. ve Yazılım' },
];

/** 5–8. sınıf: Ders, Seçmeli, İHO */
export const GRADE_5_8_DERS: SubjectEntry[] = [
  { code: 'turkce', label: 'Türkçe' },
  { code: 'matematik', label: 'Matematik' },
  { code: 'fen_bilimleri', label: 'Fen Bilimleri' },
  { code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler' },
  { code: 'ingilizce', label: 'İngilizce' },
  { code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi' },
  { code: 'muzik', label: 'Müzik' },
  { code: 'gorsel_sanatlar', label: 'Görsel Sanatlar' },
  { code: 'beden_egitimi', label: 'Beden Eğitimi ve Spor' },
  { code: 'bil_tek_yazilim', label: 'Bil. Tek. ve Yazılım' },
  { code: 'rehberlik', label: 'Rehberlik' },
  { code: 'tc_inkilap', label: 'T.C. İnkılap Tarihi ve Atatürkçülük' },
  { code: 'teknoloji_tasarim', label: 'Teknoloji ve Tasarım' },
];

export const GRADE_5_8_SECMELI: SubjectEntry[] = [
  { code: 'almanca', label: 'Almanca' },
  { code: 'arapca', label: 'Arapça' },
  { code: 'fransizca', label: 'Fransızca' },
  { code: 'matematik_uygulamalari', label: 'Matematik Uygulamaları' },
  { code: 'okuma_beceri', label: 'Okuma Becerileri' },
  { code: 'yazarlik_yazma', label: 'Yazarlık ve Yazma Becerileri' },
  { code: 'drama', label: 'Drama' },
  { code: 'zeka_oyunlari', label: 'Zeka Oyunları' },
  { code: 'muzik', label: 'Müzik' },
  { code: 'gorsel_sanatlar', label: 'Görsel Sanatlar' },
  { code: 'spor_ve_fiziki_etkinlikler', label: 'Spor ve Fiziki Etkinlikler' },
];

export const GRADE_5_8_IHO: SubjectEntry[] = [
  { code: 'arapca', label: 'Arapça' },
  { code: 'kuran_kerim', label: 'Kur\'an-ı Kerim' },
  { code: 'temel_dini_bilgiler', label: 'Temel Dini Bilgiler' },
  { code: 'siyer', label: 'Siyer' },
  { code: 'peygamberimizin_hayati', label: 'Peygamberimizin Hayatı' },
];

/** 9–12. sınıf: Lisans branşları / genel dersler */
export const GRADE_9_12_SUBJECTS: SubjectEntry[] = [
  { code: 'turk_dili_edebiyati', label: 'Türk Dili ve Edebiyatı' },
  { code: 'matematik', label: 'Matematik' },
  { code: 'fizik', label: 'Fizik' },
  { code: 'kimya', label: 'Kimya' },
  { code: 'biyoloji', label: 'Biyoloji' },
  { code: 'tarih', label: 'Tarih' },
  { code: 'cografya', label: 'Coğrafya' },
  { code: 'felsefe', label: 'Felsefe' },
  { code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi' },
  { code: 'ingilizce', label: 'İngilizce' },
  { code: 'almanca', label: 'Almanca' },
  { code: 'fransizca', label: 'Fransızca' },
  { code: 'rehberlik', label: 'Rehberlik' },
  { code: 'beden_egitimi', label: 'Beden Eğitimi ve Spor' },
  { code: 'gorsel_sanatlar', label: 'Görsel Sanatlar' },
  { code: 'muzik', label: 'Müzik' },
  { code: 'bilgisayar_bilimi', label: 'Bilgisayar Bilimi' },
  { code: 'bircestirilmis_sinif', label: 'Birleştirilmiş Sınıf (1-2, 3-4)' },
];

export type SectionKey = 'ders' | 'secmeli' | 'iho' | 'ihl' | 'meslek' | 'mesem' | 'gsl' | 'spor_l';

export function getSubjectsByGradeAndSection(
  grade: number,
  section?: SectionKey | string | null
): SubjectEntry[] {
  if (grade >= 1 && grade <= 1) {
    return section === 'ders' || !section ? GRADE_1_SUBJECTS : [];
  }
  if (grade >= 2 && grade <= 4) {
    return section === 'ders' || !section ? GRADE_2_4_SUBJECTS : [];
  }
  if (grade >= 5 && grade <= 8) {
    if (section === 'secmeli') return GRADE_5_8_SECMELI;
    if (section === 'iho') return GRADE_5_8_IHO;
    return GRADE_5_8_DERS;
  }
  if (grade >= 9 && grade <= 12) {
    return GRADE_9_12_SUBJECTS;
  }
  return [];
}

/** Zümre ders seçenekleri (sınıf adı veya branş) */
export const ZUMRE_SUBJECTS: SubjectEntry[] = [
  { code: '1_sinif', label: '1. Sınıf' },
  { code: '2_sinif', label: '2. Sınıf' },
  { code: '3_sinif', label: '3. Sınıf' },
  { code: '4_sinif', label: '4. Sınıf' },
  { code: '5_sinif', label: '5. Sınıf' },
  { code: '6_sinif', label: '6. Sınıf' },
  { code: '7_sinif', label: '7. Sınıf' },
  { code: '8_sinif', label: '8. Sınıf' },
  { code: '9_sinif', label: '9. Sınıf' },
  { code: '10_sinif', label: '10. Sınıf' },
  { code: '11_sinif', label: '11. Sınıf' },
  { code: '12_sinif', label: '12. Sınıf' },
  { code: 'turkce', label: 'Türkçe' },
  { code: 'matematik', label: 'Matematik' },
  { code: 'fen_bilimleri', label: 'Fen Bilimleri' },
  { code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler' },
  { code: 'ingilizce', label: 'İngilizce' },
  { code: 'din_kulturu', label: 'Din Kültürü' },
  { code: 'bircestirilmis_sinif', label: 'Birleştirilmiş Sınıf (1-2, 3-4)' },
];
