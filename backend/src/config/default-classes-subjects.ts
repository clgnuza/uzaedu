/**
 * TYMM MEB (tymm.meb.gov.tr) tüm dersleri – taslak çerçeve planları ve öğretim programları.
 * Kaynak: https://tymm.meb.gov.tr/taslak-cerceve-planlari, ogretim-programlari
 */

export interface DefaultClass {
  name: string;
  grade: number;
  section: string;
}

export interface DefaultSubject {
  name: string;
  code: string;
}

/** 1-12. sınıf, her sınıfta A, B, C şubeleri */
export const DEFAULT_CLASSES: DefaultClass[] = (() => {
  const list: DefaultClass[] = [];
  const sections = ['A', 'B', 'C'];
  for (let grade = 1; grade <= 12; grade++) {
    for (const section of sections) {
      list.push({ name: `${grade}/${section}`, grade, section });
    }
  }
  return list;
})();

/** TYMM MEB – Temel Eğitim (1-8) + Ortaöğretim (9-12) tüm dersler */
export const DEFAULT_SUBJECTS: DefaultSubject[] = [
  // Temel Eğitim – taslak plan + öğretim programları
  { name: 'Türkçe', code: 'turkce' },
  { name: 'Matematik', code: 'matematik' },
  { name: 'Fen Bilimleri', code: 'fen_bilimleri' },
  { name: 'Hayat Bilgisi', code: 'hayat_bilgisi' },
  { name: 'Sosyal Bilgiler', code: 'sosyal_bilgiler' },
  { name: 'İngilizce', code: 'ingilizce' },
  { name: 'Almanca', code: 'almanca' },
  { name: 'Din Kültürü ve Ahlak Bilgisi', code: 'din_kulturu' },
  { name: 'Beden Eğitimi ve Oyun', code: 'beden_egitimi_oyun' },
  { name: 'Beden Eğitimi ve Spor', code: 'beden_egitimi' },
  { name: 'Görsel Sanatlar', code: 'gorsel_sanatlar' },
  { name: 'Müzik', code: 'muzik' },
  { name: 'Bilişim Teknolojileri ve Yazılım', code: 'bil_tek_yazilim' },
  { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', code: 'tc_inkilap' },
  { name: 'İnsan Hakları, Vatandaşlık ve Demokrasi', code: 'insan_haklari' },
  { name: 'Trafik Güvenliği', code: 'trafik_guvenligi' },
  // Ortaöğretim
  { name: 'Türk Dili ve Edebiyatı', code: 'turk_dili_edebiyati' },
  { name: 'Tarih', code: 'tarih' },
  { name: 'Coğrafya', code: 'cografya' },
  { name: 'Fizik', code: 'fizik' },
  { name: 'Kimya', code: 'kimya' },
  { name: 'Biyoloji', code: 'biyoloji' },
  { name: 'Felsefe', code: 'felsefe' },
];
