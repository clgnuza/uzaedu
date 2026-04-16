/**
 * Bilsem çalışma takvimi şablonu – 2025-2026
 * Kaynak: Bilsem yıllık çalışma planı Excel şablonu
 * Hafta tarihleri ACADEMIC_CALENDAR_2025_2026 ile aynı (work_calendar eşleşmesi)
 */

export type BilsemItemType = 'belirli_gun_hafta' | 'dep' | 'tanilama' | 'diger';

export interface BilsemSeedItem {
  type: BilsemItemType;
  title: string;
  path?: string | null;
}

/** Hafta bazlı Bilsem öğeleri – ACADEMIC_CALENDAR_2025_2026 start/end ile eşleşir */
export const BILSEM_CALENDAR_2025_2026: Array<{
  start: string;
  end: string;
  items: BilsemSeedItem[];
}> = [
  { start: '2025-09-01', end: '2025-09-08', items: [
    { type: 'diger', title: 'Elektrik su, baca, kalorifer ve kanalizasyon kontrolü ve bakımı' },
    { type: 'diger', title: 'Kurumdaki birimlerin eğitim-öğretime hazır hale getirilmesi' },
    { type: 'diger', title: 'Personel görev dağılımlarının yapılması' },
    { type: 'diger', title: 'Öğretmen ihtiyacının belirlenmesi ve atama/görevlendirme' },
    { type: 'dep', title: 'Destek, BYF, ÖYG ve PROJE EĞİTİMİ Programlarının hazırlanması' },
    { type: 'diger', title: 'Kayıt yenileme işlemleri' },
    { type: 'diger', title: 'Ders dağıtım programlarının hazırlanması' },
    { type: 'belirli_gun_hafta', title: 'Uluslararası Temiz Hava Günü' },
    { type: 'belirli_gun_hafta', title: 'İlköğretim Haftası' },
  ]},
  { start: '2025-09-08', end: '2025-09-12', items: [
    { type: 'belirli_gun_hafta', title: 'İlköğretim Haftası' },
    { type: 'diger', title: '2025-2026 1. Dönem Eğitim Öğretimin Başlaması' },
    { type: 'dep', title: 'Destek, BYF, ÖYG ve PROJE EĞİTİMİ Programlarının uygulanması' },
    { type: 'diger', title: 'Velilere yönelik bilgilendirme toplantısı' },
  ]},
  { start: '2025-09-15', end: '2025-09-19', items: [
    { type: 'diger', title: 'Öğretmenlerin ücret onaylarının alınması' },
    { type: 'belirli_gun_hafta', title: '15 Temmuz Demokrasi ve Milli Birlik Günü' },
    { type: 'diger', title: '2025-2026 Stratejik Eylem Planının Hazırlanması' },
  ]},
  { start: '2025-09-22', end: '2025-09-26', items: [
    { type: 'diger', title: 'Brifing dosyasının hazırlanması' },
  ]},
  { start: '2025-09-29', end: '2025-10-03', items: [
    { type: 'diger', title: 'Kurumla ilgili istatistik bilgilerin hazırlanması (MEBİS)' },
    { type: 'diger', title: 'Birimlerin ihtiyaçlarının karşılanması' },
    { type: 'diger', title: 'Kurum Web sitesinin desteklenmesi ve geliştirilmesi' },
  ]},
  { start: '2025-10-06', end: '2025-10-10', items: [
    { type: 'dep', title: 'Destek Eğitimi ve Bireysel Yetenekleri Fark Ettirme çalışmaları' },
    { type: 'diger', title: 'Kurum içi koordinasyon toplantıları' },
  ]},
  { start: '2025-10-13', end: '2025-10-17', items: [
    { type: 'diger', title: 'Stratejik Planın gözden geçirilmesi, Eylem Planının teslim edilmesi' },
  ]},
  { start: '2025-10-20', end: '2025-10-24', items: [
    { type: 'tanilama', title: 'Proje Konularının Öğrencilere Dağıtılması' },
    { type: 'diger', title: 'Kurumdaki araç gereçlerin ilgililere zimmetlenmesi' },
    { type: 'diger', title: 'Kurumun donatım eksikliklerinin belirlenerek talepte bulunulması' },
    { type: 'diger', title: 'Kurum Kütüphanesinin düzenlenmesi' },
  ]},
  { start: '2025-10-27', end: '2025-10-31', items: [
    { type: 'tanilama', title: 'Danışman öğretmenlerce aile ziyaretlerine başlanması' },
    { type: 'belirli_gun_hafta', title: 'Cumhuriyet Bayramı' },
  ]},
  { start: '2025-11-03', end: '2025-11-07', items: [
    { type: 'dep', title: 'Proje grubu çalışmaları' },
    { type: 'diger', title: 'Kızılay Haftası etkinlikleri' },
  ]},
  { start: '2025-11-10', end: '2025-11-14', items: [
    { type: 'belirli_gun_hafta', title: 'Atatürk Haftası' },
    { type: 'diger', title: 'Birinci Dönem Ara Tatili' },
  ]},
  { start: '2025-11-17', end: '2025-11-21', items: [
    { type: 'belirli_gun_hafta', title: 'Dünya Çocuk Hakları Günü' },
    { type: 'diger', title: 'Birim ziyaretlerinin yapılması, eksikliklerin tamamlanması' },
  ]},
  { start: '2025-11-24', end: '2025-11-28', items: [
    { type: 'belirli_gun_hafta', title: 'Öğretmenler Günü ve Öğretmenler Haftası' },
    { type: 'diger', title: 'Stratejik Planlama Dönem raporunun gönderilmesi' },
  ]},
  { start: '2025-12-01', end: '2025-12-05', items: [
    { type: 'diger', title: 'Dünya Engelliler Günü etkinlikleri' },
    { type: 'dep', title: 'Haftalık program değerlendirmesi' },
  ]},
  { start: '2025-12-08', end: '2025-12-12', items: [
    { type: 'diger', title: 'Mevlana Haftası etkinlikleri' },
    { type: 'dep', title: 'Bireysel çalışma takibi' },
  ]},
  { start: '2025-12-15', end: '2025-12-19', items: [
    { type: 'diger', title: 'Sayım komisyonunca taşınırların sayımlarının yapılması' },
  ]},
  { start: '2025-12-22', end: '2025-12-26', items: [
    { type: "diger", title: "Mehmet Akif Ersoy'u Anma Haftası" },
    { type: 'dep', title: 'Yarıyıl hazırlık çalışmaları' },
  ]},
  { start: '2025-12-29', end: '2026-01-02', items: [
    { type: 'belirli_gun_hafta', title: 'Yılbaşı Tatili' },
    { type: 'diger', title: 'Merkez iş ve işlemleri, Yılsonu hesaplarının kapatılması' },
    { type: 'diger', title: 'Büro ve idari evrakların yıl sonu itibariyle kapatılması' },
  ]},
  { start: '2026-01-05', end: '2026-01-09', items: [
    { type: 'diger', title: 'Dosyaların arşivlenmesi, yeniden düzenlenmesi' },
    { type: 'diger', title: 'Gelen-giden evrak, zimmet, izin, devam-devamsızlık işlemleri' },
    { type: 'tanilama', title: 'Grup Taramalarının Başlaması' },
  ]},
  { start: '2026-01-12', end: '2026-01-16', items: [
    { type: 'diger', title: 'Dönem Sonu Konseri ve Kareoke Etkinliği' },
    { type: 'diger', title: 'Sivil savunma ve yangın malzemelerinin bakımı' },
    { type: 'diger', title: 'Birinci Dönem Sonu Yarıyıl Tatili' },
    { type: 'diger', title: 'Birinci dönem sonu raporunun Gen. Müd. gönderilmesi' },
  ]},
  { start: '2026-01-19', end: '2026-01-30', items: [
    { type: 'diger', title: 'Yarıyıl tatili' },
  ]},
  { start: '2026-02-02', end: '2026-02-06', items: [
    { type: 'diger', title: 'İkinci yarıyılın başlaması' },
    { type: 'diger', title: 'Öğretmenler Kurulunun Yapılması' },
  ]},
  { start: '2026-02-09', end: '2026-02-13', items: [
    { type: 'dep', title: 'İkinci yarıyıl program uyarlamaları' },
    { type: 'diger', title: 'Güvenli İnternet Günü etkinlikleri' },
  ]},
  { start: '2026-02-16', end: '2026-02-20', items: [
    { type: 'diger', title: 'Matematik Hayatımızda' },
    { type: 'diger', title: 'Eğitim Programlarının değerlendirilmesi' },
    { type: 'dep', title: 'Proje Grubu ile Atılım Sanayi Sitesi ziyareti' },
  ]},
  { start: '2026-02-23', end: '2026-02-27', items: [
    { type: 'belirli_gun_hafta', title: 'Sivil Savunma Günü' },
  ]},
  { start: '2026-03-02', end: '2026-03-06', items: [
    { type: 'diger', title: 'Yeşilay Haftası etkinlikleri' },
    { type: 'dep', title: 'Proje ilerleme değerlendirmesi' },
  ]},
  { start: '2026-03-09', end: '2026-03-13', items: [
    { type: 'belirli_gun_hafta', title: '1-7 Mart Deprem Haftası' },
    { type: 'diger', title: 'Ödeneklerin takibi ve harcama planlarının hazırlanması' },
    { type: 'diger', title: 'Bina onarım ihtiyacının belirlenmesi' },
    { type: 'belirli_gun_hafta', title: 'Bilim ve Teknoloji Haftası' },
    { type: "belirli_gun_hafta", title: "İstiklal Marşının Kabulü ve Mehmet Akif Ersoy'u Anma Günü" },
  ]},
  { start: '2026-03-16', end: '2026-03-20', items: [
    { type: 'diger', title: 'İkinci Dönem Ara Tatili' },
    { type: 'belirli_gun_hafta', title: 'Çanakkale Şehitlerini Anma Günü' },
  ]},
  { start: '2026-03-23', end: '2026-03-27', items: [
    { type: 'belirli_gun_hafta', title: 'Kütüphaneler Haftası' },
    { type: 'tanilama', title: 'Danışman öğretmenlerce veli ve okul ziyaretleri' },
  ]},
  { start: '2026-03-30', end: '2026-04-03', items: [
    { type: 'belirli_gun_hafta', title: 'Dünya Otizm Farkındalık Günü' },
    { type: 'dep', title: 'Bireysel değerlendirme hazırlıkları' },
  ]},
  { start: '2026-04-06', end: '2026-04-10', items: [
    { type: 'dep', title: 'Destek Eğitimi, Bireysel Yetenekleri Fark Ettirme değerlendirmeleri' },
    { type: 'tanilama', title: 'Bireysel değerlendirmelerin yapılması' },
  ]},
  { start: '2026-04-13', end: '2026-04-17', items: [
    { type: 'diger', title: 'Turizm Haftası etkinlikleri' },
    { type: 'dep', title: '23 Nisan hazırlık çalışmaları' },
  ]},
  { start: '2026-04-20', end: '2026-04-24', items: [
    { type: 'belirli_gun_hafta', title: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı' },
  ]},
  { start: '2026-04-27', end: '2026-05-01', items: [
    { type: 'belirli_gun_hafta', title: 'Emek ve Dayanışma Günü' },
  ]},
  { start: '2026-05-04', end: '2026-05-08', items: [
    { type: 'diger', title: 'Müzik Öğrencilerinin Yılsonu Konseri' },
    { type: 'diger', title: 'Yıl Sonu Görsel Sanatlar Sergisi (Resim)' },
    { type: 'belirli_gun_hafta', title: 'Müzeler Haftası' },
  ]},
  { start: '2026-05-11', end: '2026-05-15', items: [
    { type: 'diger', title: 'Engelliler Haftası etkinlikleri' },
    { type: 'dep', title: '19 Mayıs hazırlık çalışmaları' },
  ]},
  { start: '2026-05-18', end: '2026-05-22', items: [
    { type: "belirli_gun_hafta", title: "19 Mayıs Atatürk'ü Anma Gençlik ve Spor Bayramı" },
  ]},
  { start: '2026-05-25', end: '2026-05-29', items: [
    { type: 'dep', title: 'Proje Sunum Haftası' },
  ]},
  { start: '2026-06-01', end: '2026-06-05', items: [
    { type: 'belirli_gun_hafta', title: 'Bilişim Haftası' },
    { type: 'diger', title: 'Robotlar Günlük Hayatımızda' },
  ]},
  { start: '2026-06-08', end: '2026-06-12', items: [
    { type: 'diger', title: 'Eğitim Dönemi Sonu' },
    { type: 'diger', title: 'Proje İlerleme ve Sonuç Raporlarının teslim edilmesi' },
    { type: 'belirli_gun_hafta', title: 'Çevre ve İklim Değişikliği Haftası' },
  ]},
  { start: '2026-06-15', end: '2026-06-19', items: [
    { type: 'diger', title: 'Yıl sonu evrak işlemleri' },
    { type: 'dep', title: 'Dönem değerlendirme toplantıları' },
  ]},
  { start: '2026-06-22', end: '2026-06-26', items: [
    { type: 'diger', title: 'Kurum kapanış işlemleri' },
    { type: 'dep', title: 'Yaz dönemi planlaması' },
  ]},
  { start: '2026-06-29', end: '2026-07-03', items: [
    { type: 'diger', title: 'Sene sonu öğretmenler kurulu toplantısı' },
    { type: 'diger', title: 'II. Dönem Yılsonu Değerlendirme Raporlarının gönderilmesi' },
    { type: 'diger', title: 'Öğretmenlerin tatile girmesi' },
    { type: 'belirli_gun_hafta', title: '15 Temmuz Demokrasi ve Şehitler Haftası' },
    { type: 'diger', title: 'Kurumun Eğitim-Öğretime Hazırlık Çalışmaları' },
    { type: 'belirli_gun_hafta', title: '30 Ağustos Zafer Bayramı' },
  ]},
];
