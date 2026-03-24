/**
 * Evrak katalogu seed – ÖğretmenEvrak kaynak siteden tam başlıklar.
 * https://ogretmenevrak.com/
 */
import { DocumentCatalog } from './entities/document-catalog.entity';
import type { DocumentCatalogCategory } from './entities/document-catalog.entity';

export interface CatalogSeedItem {
  category: DocumentCatalogCategory;
  parentCode?: string | null;
  code: string;
  label: string;
  gradeMin?: number | null;
  gradeMax?: number | null;
  sectionFilter?: string | null;
  anaGrup?: string | null;
  sortOrder: number;
}

/** BİLSEM Ek-1 Program Uygulama Tablosu – Genel Zihinsel Yetenek alanına göre tanılanan öğrencilerin alabileceği alanlar */
export const BILSEM_SUBJECTS_SEED: (CatalogSeedItem & { anaGrup: string })[] = [
  { category: 'subject', code: 'bilsem_sinif_ogretmenligi', label: 'Sınıf Öğretmenliği', anaGrup: 'GENEL_YETENEK', sortOrder: 3001 },
  { category: 'subject', code: 'bilsem_fen_teknik', label: 'Fen ve Teknoloji', anaGrup: 'GENEL_YETENEK', sortOrder: 3002 },
  { category: 'subject', code: 'bilsem_ilkogretim_matematik', label: 'İlköğretim Matematik', anaGrup: 'GENEL_YETENEK', sortOrder: 3003 },
  { category: 'subject', code: 'bilsem_rehberlik', label: 'Rehberlik', anaGrup: 'GENEL_YETENEK', sortOrder: 3004 },
  { category: 'subject', code: 'bilsem_sosyal_bilgiler', label: 'Sosyal Bilgiler', anaGrup: 'GENEL_YETENEK', sortOrder: 3005 },
  { category: 'subject', code: 'bilsem_teknoloji_tasarim', label: 'Teknoloji ve Tasarım', anaGrup: 'GENEL_YETENEK', sortOrder: 3006 },
  { category: 'subject', code: 'bilsem_turkce', label: 'Türkçe', anaGrup: 'GENEL_YETENEK', sortOrder: 3007 },
  { category: 'subject', code: 'bilsem_yabanci_dil', label: 'Yabancı Dil', anaGrup: 'GENEL_YETENEK', sortOrder: 3008 },
  { category: 'subject', code: 'bilsem_bil_tek_yazilim', label: 'Bilişim Teknolojileri ve Yazılım', anaGrup: 'GENEL_YETENEK', sortOrder: 3009 },
  { category: 'subject', code: 'bilsem_gorsel_sanatlar', label: 'Görsel Sanatlar', anaGrup: 'GENEL_YETENEK', sortOrder: 3010 },
  { category: 'subject', code: 'bilsem_muzik', label: 'Müzik', anaGrup: 'GENEL_YETENEK', sortOrder: 3011 },
  { category: 'subject', code: 'bilsem_turk_dili_edebiyati', label: 'Türk Dili ve Edebiyatı', anaGrup: 'GENEL_YETENEK', sortOrder: 3012 },
  { category: 'subject', code: 'bilsem_biyoloji', label: 'Biyoloji', anaGrup: 'GENEL_YETENEK', sortOrder: 3013 },
  { category: 'subject', code: 'bilsem_cografya', label: 'Coğrafya', anaGrup: 'GENEL_YETENEK', sortOrder: 3014 },
  { category: 'subject', code: 'bilsem_felsefe', label: 'Felsefe', anaGrup: 'GENEL_YETENEK', sortOrder: 3015 },
  { category: 'subject', code: 'bilsem_fizik', label: 'Fizik', anaGrup: 'GENEL_YETENEK', sortOrder: 3016 },
  { category: 'subject', code: 'bilsem_kimya', label: 'Kimya', anaGrup: 'GENEL_YETENEK', sortOrder: 3017 },
  { category: 'subject', code: 'bilsem_lise_matematik', label: 'Lise Matematik', anaGrup: 'GENEL_YETENEK', sortOrder: 3018 },
  { category: 'subject', code: 'bilsem_tarih', label: 'Tarih', anaGrup: 'GENEL_YETENEK', sortOrder: 3019 },
  { category: 'subject', code: 'bilsem_resim', label: 'Resim (Görsel Sanatlar Alanı)', anaGrup: 'RESIM', sortOrder: 3020 },
  { category: 'subject', code: 'bilsem_muzik_alan', label: 'Müzik (Müzik Alanı)', anaGrup: 'MUZIK', sortOrder: 3021 },
];

/** ÖğretmenEvrak tam başlıkları – evrak türleri */
export const EVRAK_TYPES_SEED: CatalogSeedItem[] = [
  { category: 'evrak_type', code: 'yillik_plan', label: 'Yıllık Plan', sortOrder: 10 },
  { category: 'evrak_type', code: 'gunluk_plan', label: 'Günlük Plan', sortOrder: 20 },
  { category: 'evrak_type', code: 'egzersiz_plan', label: 'Egzersiz Planları', sortOrder: 30 },
  { category: 'evrak_type', code: 'iyep_plan', label: 'İYEP Planları', sortOrder: 40 },
  { category: 'evrak_type', code: 'bep_plan', label: 'BEP Planları', sortOrder: 50 },
  { category: 'evrak_type', code: 'zumre', label: 'Zümre Evrakları', sortOrder: 60 },
  { category: 'evrak_type', code: 'kulup_evrak', label: 'Kulüp Evrak', sortOrder: 70 },
  { category: 'evrak_type', code: 'veli_toplanti_tutanak', label: 'Veli Toplantı Tutanağı', sortOrder: 80 },
  { category: 'evrak_type', code: 'aday_ogretmen_dosyasi', label: 'Aday Öğretmen Dosyası', sortOrder: 90 },
  { category: 'evrak_type', code: 'rehberlik_raporu', label: 'Rehberlik Raporu', sortOrder: 100 },
  { category: 'evrak_type', code: 'dilekce', label: 'Dilekçe Örnekleri', sortOrder: 110 },
  { category: 'evrak_type', code: 'is_takvimi', label: 'İş Takvimi', sortOrder: 120 },
  { category: 'evrak_type', code: 'belirli_gun_hafta', label: 'Belirli Gün ve Haftalar', sortOrder: 130 },
  { category: 'evrak_type', code: 'mevzuat', label: 'Mevzuatlar', sortOrder: 140 },
  { category: 'evrak_type', code: 'performans_proje', label: 'Performans Proje Formları', sortOrder: 150 },
  { category: 'evrak_type', code: 'sinav_analizi', label: 'Sınav Analizleri', sortOrder: 160 },
  { category: 'evrak_type', code: 'sok_tutanak', label: 'Şök Tutanakları', sortOrder: 170 },
  { category: 'evrak_type', code: 'idari_evrak', label: 'İdari Evraklar', sortOrder: 180 },
  { category: 'evrak_type', code: 'yil_sonu_evrak', label: 'Yıl Sonu - Dönem Sonu Evrakları', sortOrder: 190 },
  { category: 'evrak_type', code: 'diger', label: 'Diğer Evraklar', sortOrder: 999 },
];

/** Okul türleri – ÖğretmenEvrak */
export const SCHOOL_TYPES_SEED: CatalogSeedItem[] = [
  { category: 'school_type', code: 'okul_oncesi', label: 'Okul Öncesi', sortOrder: 10 },
  { category: 'school_type', code: 'ilkokul', label: 'İlkokul', sortOrder: 20 },
  { category: 'school_type', code: 'ortaokul', label: 'Ortaokul', sortOrder: 30 },
  { category: 'school_type', code: 'lise', label: 'Lise', sortOrder: 40 },
  { category: 'school_type', code: 'mesem', label: 'Mesem', sortOrder: 50 },
  { category: 'school_type', code: 'ozel_egitim', label: 'Özel Eğitim', sortOrder: 60 },
  { category: 'school_type', code: 'ortaokul_secmeli', label: 'Ortaokul Seçmeli', sortOrder: 70 },
  { category: 'school_type', code: 'lise_secmeli', label: 'Lise Seçmeli', sortOrder: 80 },
];

/** Zümre türleri – ÖğretmenEvrak */
export const ZUMRE_SUB_TYPES_SEED: CatalogSeedItem[] = [
  { category: 'sub_type', parentCode: 'zumre', code: 'sene_basi', label: 'Sene Başı', sortOrder: 10 },
  { category: 'sub_type', parentCode: 'zumre', code: 'sene_sonu', label: 'Sene Sonu', sortOrder: 20 },
  { category: 'sub_type', parentCode: 'zumre', code: 'birinci_donem_ara', label: 'Birinci Dönem Ara', sortOrder: 30 },
  { category: 'sub_type', parentCode: 'zumre', code: 'ikinci_donem_basi', label: 'İkinci Dönem Başı', sortOrder: 40 },
  { category: 'sub_type', parentCode: 'zumre', code: 'ikinci_donem_ara', label: 'İkinci Dönem Ara', sortOrder: 50 },
  { category: 'sub_type', parentCode: 'zumre', code: 'eski_zumre', label: 'Eski Zümreler', sortOrder: 60 },
];

/** İYEP alt türleri */
export const IYEP_SUB_TYPES_SEED: CatalogSeedItem[] = [
  { category: 'sub_type', parentCode: 'iyep_plan', code: 'turkce', label: 'Türkçe', sortOrder: 10 },
  { category: 'sub_type', parentCode: 'iyep_plan', code: 'matematik', label: 'Matematik', sortOrder: 20 },
];

/** BEP alt türleri – ÖğretmenEvrak tam başlıklar */
export const BEP_SUB_TYPES_SEED: CatalogSeedItem[] = [
  { category: 'sub_type', parentCode: 'bep_plan', code: 'dosya', label: 'BEP Dosyası (Yeni)', sortOrder: 10 },
  { category: 'sub_type', parentCode: 'bep_plan', code: 'plan_yeni', label: 'BEP Planı (Yeni)', sortOrder: 20 },
  { category: 'sub_type', parentCode: 'bep_plan', code: 'plan_eski', label: 'BEP Planı (Eski)', sortOrder: 30 },
  { category: 'sub_type', parentCode: 'bep_plan', code: 'kaba_form', label: 'BEP Kaba Formları', sortOrder: 40 },
];

/** Plan bölümleri – ÖğretmenEvrak uyumlu */
export const SECTIONS_SEED: CatalogSeedItem[] = [
  { category: 'section', code: 'ders', label: 'Ders', sortOrder: 10 },
  { category: 'section', code: 'secmeli', label: 'Seçmeli', sortOrder: 20 },
  { category: 'section', code: 'iho', label: 'İHO (İmam Hatip Ortaokulu)', sortOrder: 30 },
  { category: 'section', code: 'ihl', label: 'İHL (İmam Hatip Lisesi)', sortOrder: 40 },
  { category: 'section', code: 'meslek', label: 'Meslek', sortOrder: 50 },
  { category: 'section', code: 'mesem', label: 'Mesem', sortOrder: 60 },
  { category: 'section', code: 'gsl', label: 'GSL (Güzel Sanatlar Lisesi)', sortOrder: 70 },
  { category: 'section', code: 'spor_l', label: 'Spor L.', sortOrder: 80 },
];

/** Dersler – sınıf ve bölüme göre, ÖğretmenEvrak tam başlıklar */
export const SUBJECTS_SEED: CatalogSeedItem[] = [
  // 1. sınıf Ders
  { category: 'subject', code: 'turkce_maarif', label: 'Türkçe - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 1 },
  { category: 'subject', code: 'serbest_etkinlik', label: 'Serbest Etkinlik', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 2 },
  { category: 'subject', code: 'rehberlik', label: 'Rehberlik', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 3 },
  { category: 'subject', code: 'muzik_maarif', label: 'Müzik - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 4 },
  { category: 'subject', code: 'matematik_maarif', label: 'Matematik - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 5 },
  { category: 'subject', code: 'hayat_bilgisi_maarif', label: 'Hayat Bilgisi - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 6 },
  { category: 'subject', code: 'gorsel_sanatlar_maarif', label: 'Görsel Sanatlar - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 7 },
  { category: 'subject', code: 'beden_egitimi_oyun_maarif', label: 'Beden Eğitimi ve Oyun - Maarif M.', gradeMin: 1, gradeMax: 1, sectionFilter: 'ders', sortOrder: 8 },
  // 2–4 Ders
  { category: 'subject', code: 'turkce_maarif', label: 'Türkçe - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 20 },
  { category: 'subject', code: 'matematik_maarif', label: 'Matematik - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 21 },
  { category: 'subject', code: 'hayat_bilgisi_maarif', label: 'Hayat Bilgisi - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 22 },
  { category: 'subject', code: 'fen_bilimleri_maarif', label: 'Fen Bilimleri - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 23 },
  { category: 'subject', code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 24 },
  { category: 'subject', code: 'muzik_maarif', label: 'Müzik - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 25 },
  { category: 'subject', code: 'gorsel_sanatlar_maarif', label: 'Görsel Sanatlar - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 26 },
  { category: 'subject', code: 'beden_egitimi_maarif', label: 'Beden Eğitimi ve Spor - Maarif M.', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 27 },
  { category: 'subject', code: 'ingilizce', label: 'İngilizce', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 28 },
  { category: 'subject', code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 29 },
  { category: 'subject', code: 'serbest_etkinlik', label: 'Serbest Etkinlik', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 30 },
  { category: 'subject', code: 'rehberlik', label: 'Rehberlik', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 31 },
  { category: 'subject', code: 'bil_tek_yazilim', label: 'Bil. Tek. ve Yazılım', gradeMin: 2, gradeMax: 4, sectionFilter: 'ders', sortOrder: 32 },
  // 5–8 Ders
  { category: 'subject', code: 'turkce', label: 'Türkçe', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 40 },
  { category: 'subject', code: 'matematik', label: 'Matematik', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 41 },
  { category: 'subject', code: 'fen_bilimleri', label: 'Fen Bilimleri', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 42 },
  { category: 'subject', code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 43 },
  { category: 'subject', code: 'ingilizce', label: 'İngilizce', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 44 },
  { category: 'subject', code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 45 },
  { category: 'subject', code: 'muzik', label: 'Müzik', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 46 },
  { category: 'subject', code: 'gorsel_sanatlar', label: 'Görsel Sanatlar', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 47 },
  { category: 'subject', code: 'beden_egitimi', label: 'Beden Eğitimi ve Spor', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 48 },
  { category: 'subject', code: 'bil_tek_yazilim', label: 'Bil. Tek. ve Yazılım', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 49 },
  { category: 'subject', code: 'rehberlik', label: 'Rehberlik', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 50 },
  { category: 'subject', code: 'tc_inkilap', label: 'T.C. İnkılap Tarihi ve Atatürkçülük', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 51 },
  { category: 'subject', code: 'teknoloji_tasarim', label: 'Teknoloji ve Tasarım', gradeMin: 5, gradeMax: 8, sectionFilter: 'ders', sortOrder: 52 },
  // 5–8 Seçmeli
  { category: 'subject', code: 'almanca', label: 'Almanca', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 60 },
  { category: 'subject', code: 'arapca', label: 'Arapça', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 61 },
  { category: 'subject', code: 'fransizca', label: 'Fransızca', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 62 },
  { category: 'subject', code: 'matematik_uygulamalari', label: 'Matematik Uygulamaları', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 63 },
  { category: 'subject', code: 'okuma_beceri', label: 'Okuma Becerileri', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 64 },
  { category: 'subject', code: 'yazarlik_yazma', label: 'Yazarlık ve Yazma Becerileri', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 65 },
  { category: 'subject', code: 'drama', label: 'Drama', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 66 },
  { category: 'subject', code: 'zeka_oyunlari', label: 'Zeka Oyunları', gradeMin: 5, gradeMax: 8, sectionFilter: 'secmeli', sortOrder: 67 },
  // 5–8 İHO
  { category: 'subject', code: 'arapca', label: 'Arapça', gradeMin: 5, gradeMax: 8, sectionFilter: 'iho', sortOrder: 80 },
  { category: 'subject', code: 'kuran_kerim', label: 'Kur\'an-ı Kerim', gradeMin: 5, gradeMax: 8, sectionFilter: 'iho', sortOrder: 81 },
  { category: 'subject', code: 'temel_dini_bilgiler', label: 'Temel Dini Bilgiler', gradeMin: 5, gradeMax: 8, sectionFilter: 'iho', sortOrder: 82 },
  { category: 'subject', code: 'siyer', label: 'Siyer', gradeMin: 5, gradeMax: 8, sectionFilter: 'iho', sortOrder: 83 },
  { category: 'subject', code: 'peygamberimizin_hayati', label: 'Peygamberimizin Hayatı', gradeMin: 5, gradeMax: 8, sectionFilter: 'iho', sortOrder: 84 },
  // 9–12 Ders (genel + Maarif M. varyantları – A.L./F.L./S.B.L. ders saati farkı için)
  { category: 'subject', code: 'turk_dili_edebiyati', label: 'Türk Dili ve Edebiyatı', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 100 },
  { category: 'subject', code: 'turk_dili_edebiyati_maarif_al', label: 'Türk Dili ve Edeb. - Maarif (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1001 },
  { category: 'subject', code: 'turk_dili_edebiyati_maarif_fl', label: 'Türk Dili ve Edeb. - Maarif (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1002 },
  { category: 'subject', code: 'turk_dili_edebiyati_maarif_sbl', label: 'Türk Dili ve Edeb. - Maarif (S.B.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1003 },
  { category: 'subject', code: 'matematik', label: 'Matematik', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 101 },
  { category: 'subject', code: 'matematik_maarif_al', label: 'Matematik - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1011 },
  { category: 'subject', code: 'matematik_maarif_fl', label: 'Matematik - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1012 },
  { category: 'subject', code: 'fizik', label: 'Fizik', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 102 },
  { category: 'subject', code: 'fizik_maarif_al', label: 'Fizik - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1021 },
  { category: 'subject', code: 'fizik_maarif_fl', label: 'Fizik - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1022 },
  { category: 'subject', code: 'kimya', label: 'Kimya', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 103 },
  { category: 'subject', code: 'kimya_maarif_al', label: 'Kimya - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1031 },
  { category: 'subject', code: 'kimya_maarif_fl', label: 'Kimya - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1032 },
  { category: 'subject', code: 'biyoloji', label: 'Biyoloji', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 104 },
  { category: 'subject', code: 'biyoloji_maarif_al', label: 'Biyoloji - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1041 },
  { category: 'subject', code: 'biyoloji_maarif_fl', label: 'Biyoloji - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1042 },
  { category: 'subject', code: 'tarih', label: 'Tarih', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 105 },
  { category: 'subject', code: 'tarih_maarif_al', label: 'Tarih - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1051 },
  { category: 'subject', code: 'tarih_maarif_fl', label: 'Tarih - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1052 },
  { category: 'subject', code: 'tarih_maarif_sbl', label: 'Tarih - Maarif M. (S.B.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1053 },
  { category: 'subject', code: 'cografya', label: 'Coğrafya', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 106 },
  { category: 'subject', code: 'cografya_maarif_al', label: 'Coğrafya - Maarif M. (A.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1061 },
  { category: 'subject', code: 'cografya_maarif_fl', label: 'Coğrafya - Maarif M. (F.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1062 },
  { category: 'subject', code: 'cografya_maarif_sbl', label: 'Coğrafya - Maarif M. (S.B.L.)', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1063 },
  { category: 'subject', code: 'felsefe', label: 'Felsefe', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 107 },
  { category: 'subject', code: 'din_kulturu', label: 'Din Kültürü ve Ahlak Bilgisi', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 108 },
  { category: 'subject', code: 'din_kulturu_maarif', label: 'Din Kült. ve Ahlak Bil - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1081 },
  { category: 'subject', code: 'ingilizce', label: 'İngilizce', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 109 },
  { category: 'subject', code: 'ingilizce_maarif', label: 'İngilizce - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1091 },
  { category: 'subject', code: 'almanca', label: 'Almanca', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 110 },
  { category: 'subject', code: 'fransizca', label: 'Fransızca', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 111 },
  { category: 'subject', code: 'rehberlik', label: 'Rehberlik', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 112 },
  { category: 'subject', code: 'beden_egitimi', label: 'Beden Eğitimi ve Spor', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 113 },
  { category: 'subject', code: 'beden_egitimi_maarif', label: 'Beden Eğitimi ve Spor - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1131 },
  { category: 'subject', code: 'gorsel_sanatlar', label: 'Görsel Sanatlar', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 114 },
  { category: 'subject', code: 'gorsel_sanatlar_maarif', label: 'Görsel Sanatlar - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1141 },
  { category: 'subject', code: 'muzik', label: 'Müzik', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 115 },
  { category: 'subject', code: 'muzik_maarif', label: 'Müzik - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 1151 },
  { category: 'subject', code: 'bilgisayar_bilimi', label: 'Bilgisayar Bilimi', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 116 },
  { category: 'subject', code: 'kuran_kerim_maarif', label: 'Kur\'an-ı Kerim - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 117 },
  { category: 'subject', code: 'temel_dini_bilgiler_maarif', label: 'Temel Dini Bilgiler - Maarif M.', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 118 },
  { category: 'subject', code: 'saglik_bilgisi_trafik', label: 'Sağlık Bilgisi ve Trafik Kültürü', gradeMin: 9, gradeMax: 12, sectionFilter: 'ders', sortOrder: 119 },
  // 9–12 İHL (İmam Hatip Lisesi)
  { category: 'subject', code: 'arapca', label: 'Arapça', gradeMin: 9, gradeMax: 12, sectionFilter: 'ihl', sortOrder: 200 },
  { category: 'subject', code: 'kuran_kerim', label: 'Kur\'an-ı Kerim', gradeMin: 9, gradeMax: 12, sectionFilter: 'ihl', sortOrder: 201 },
  { category: 'subject', code: 'temel_dini_bilgiler', label: 'Temel Dini Bilgiler', gradeMin: 9, gradeMax: 12, sectionFilter: 'ihl', sortOrder: 202 },
  { category: 'subject', code: 'siyer', label: 'Siyer', gradeMin: 9, gradeMax: 12, sectionFilter: 'ihl', sortOrder: 203 },
  { category: 'subject', code: 'peygamberimizin_hayati', label: 'Peygamberimizin Hayatı', gradeMin: 9, gradeMax: 12, sectionFilter: 'ihl', sortOrder: 204 },
  // Zümre dersleri
  { category: 'subject', code: '1_sinif', label: '1. Sınıf', sortOrder: 200 },
  { category: 'subject', code: '2_sinif', label: '2. Sınıf', sortOrder: 201 },
  { category: 'subject', code: '3_sinif', label: '3. Sınıf', sortOrder: 202 },
  { category: 'subject', code: '4_sinif', label: '4. Sınıf', sortOrder: 203 },
  { category: 'subject', code: '5_sinif', label: '5. Sınıf', sortOrder: 204 },
  { category: 'subject', code: '6_sinif', label: '6. Sınıf', sortOrder: 205 },
  { category: 'subject', code: '7_sinif', label: '7. Sınıf', sortOrder: 206 },
  { category: 'subject', code: '8_sinif', label: '8. Sınıf', sortOrder: 207 },
  { category: 'subject', code: '9_sinif', label: '9. Sınıf', sortOrder: 208 },
  { category: 'subject', code: '10_sinif', label: '10. Sınıf', sortOrder: 209 },
  { category: 'subject', code: '11_sinif', label: '11. Sınıf', sortOrder: 210 },
  { category: 'subject', code: '12_sinif', label: '12. Sınıf', sortOrder: 211 },
  { category: 'subject', code: 'turkce', label: 'Türkçe', sortOrder: 220 },
  { category: 'subject', code: 'matematik', label: 'Matematik', sortOrder: 221 },
  { category: 'subject', code: 'fen_bilimleri', label: 'Fen Bilimleri', sortOrder: 222 },
  { category: 'subject', code: 'sosyal_bilgiler', label: 'Sosyal Bilgiler', sortOrder: 223 },
  { category: 'subject', code: 'ingilizce', label: 'İngilizce', sortOrder: 224 },
  { category: 'subject', code: 'din_kulturu', label: 'Din Kültürü', sortOrder: 225 },
  { category: 'subject', code: 'bircestirilmis_sinif', label: 'Birleştirilmiş Sınıf (1-2, 3-4)', sortOrder: 230 },
];

export function getAllSeedItems(): Partial<DocumentCatalog>[] {
  const items: Partial<DocumentCatalog>[] = [];
  let order = 0;
  for (const s of EVRAK_TYPES_SEED) {
    items.push({
      category: s.category,
      parentCode: s.parentCode ?? null,
      code: s.code,
      label: s.label,
      gradeMin: s.gradeMin ?? null,
      gradeMax: s.gradeMax ?? null,
      sectionFilter: s.sectionFilter ?? null,
      sortOrder: s.sortOrder,
      isActive: true,
    });
  }
  for (const s of SCHOOL_TYPES_SEED) {
    items.push({
      category: s.category,
      parentCode: null,
      code: s.code,
      label: s.label,
      sortOrder: s.sortOrder,
      isActive: true,
    });
  }
  for (const s of [...ZUMRE_SUB_TYPES_SEED, ...IYEP_SUB_TYPES_SEED, ...BEP_SUB_TYPES_SEED]) {
    items.push({
      category: s.category,
      parentCode: s.parentCode ?? null,
      code: s.code,
      label: s.label,
      sortOrder: s.sortOrder,
      isActive: true,
    });
  }
  for (const s of SECTIONS_SEED) {
    items.push({
      category: s.category,
      parentCode: null,
      code: s.code,
      label: s.label,
      sortOrder: s.sortOrder,
      isActive: true,
    });
  }
  for (const s of SUBJECTS_SEED) {
    items.push({
      category: s.category,
      parentCode: null,
      code: s.code,
      label: s.label,
      gradeMin: s.gradeMin ?? null,
      gradeMax: s.gradeMax ?? null,
      sectionFilter: s.sectionFilter ?? null,
      anaGrup: (s as CatalogSeedItem & { anaGrup?: string }).anaGrup ?? null,
      sortOrder: s.sortOrder ?? 0,
      isActive: true,
    });
  }
  for (const s of BILSEM_SUBJECTS_SEED) {
    items.push({
      category: s.category,
      parentCode: null,
      code: s.code,
      label: s.label,
      gradeMin: null,
      gradeMax: null,
      sectionFilter: null,
      anaGrup: s.anaGrup,
      sortOrder: s.sortOrder,
      isActive: true,
    });
  }
  return items;
}
