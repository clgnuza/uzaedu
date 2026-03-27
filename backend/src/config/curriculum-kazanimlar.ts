/**
 * MEB müfredat kazanım tam metinleri – GPT taslak için.
 * Kaynak: MEB Öğretim Programları (talimterbiye.meb.gov.tr)
 * GPT sadece bu metinleri kullanır; haftalara dağıtır, konu ekler.
 */

export interface MebKazanim {
  /** Kazanım kodu (COĞ.9.1.1 vb.) */
  code: string;
  /** MEB tam metin – aynen kullanılacak */
  metin: string;
  /** Ünite adı */
  unite: string;
  /** Önerilen konu başlığı (GPT referans alabilir) */
  konu_suggest?: string;
}

/** Ders -> Sınıf -> Kazanım listesi */
export const CURRICULUM_KAZANIMLAR: Record<string, Record<number, MebKazanim[]>> = {
  cografya: {
    9: [
      { code: 'COĞ.9.1.1', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.1. Coğrafyanın konusu ve alt dallarını açıklar.', konu_suggest: 'Coğrafyanın Konusu ve Bölümleri' },
      { code: 'COĞ.9.1.2', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.2. Mekânsal düşünmenin ve coğrafya öğrenmenin önemini açıklar.', konu_suggest: 'Niçin Coğrafya Öğreniriz?' },
      { code: 'COĞ.9.1.3', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.3. Coğrafya biliminin gelişimini temel örneklerle açıklar.', konu_suggest: 'Coğrafyanın Gelişimi' },
      { code: 'COĞ.9.2.1', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.9.2.1. Haritaları okur, yorumlar ve basit harita uygulamaları yapar.', konu_suggest: 'Haritalar' },
      { code: 'COĞ.9.2.2', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: "COĞ.9.2.2. Türkiye'nin konum özelliklerini açıklar.", konu_suggest: "Türkiye'nin Coğrafi Konumu" },
      { code: 'COĞ.9.2.3', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.9.2.3. Mekânsal bilgi teknolojilerinin temel bileşenlerini tanır.', konu_suggest: 'Mekânsal Bilgi Teknolojileri' },
      { code: 'COĞ.9.3.1', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.1. Hava olaylarını ve günlük yaşama etkilerini açıklar.', konu_suggest: 'Hava Olayları' },
      { code: 'COĞ.9.3.2', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.2. İklim elemanlarını ve aralarındaki ilişkiyi açıklar.', konu_suggest: 'İklim Elemanları' },
      { code: 'COĞ.9.3.3', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: "COĞ.9.3.3. Türkiye'nin iklim özelliklerini değerlendirir.", konu_suggest: 'Türkiye İklimi' },
      { code: 'COĞ.9.3.4', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.4. Yer şekillerinin oluşumunda etkili süreçleri açıklar.', konu_suggest: 'Yer Şekillerinin Oluşumu' },
      { code: 'COĞ.9.3.5', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: "COĞ.9.3.5. Türkiye'deki yer şekillerinin dağılışını yorumlar.", konu_suggest: "Türkiye'de Yer Şekilleri" },
      { code: 'COĞ.9.3.6', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.6. Su kaynaklarının kullanımını ve önemini değerlendirir.', konu_suggest: 'Su Kaynakları' },
      { code: 'COĞ.9.4.1', unite: 'BEŞERÎ SİSTEMLER', metin: 'COĞ.9.4.1. Nüfusun temel özelliklerini ve dağılışını yorumlar.', konu_suggest: 'Nüfus ve Yerleşme' },
      { code: 'COĞ.9.4.2', unite: 'BEŞERÎ SİSTEMLER', metin: 'COĞ.9.4.2. Yerleşme tiplerini ve özelliklerini açıklar.', konu_suggest: 'Yerleşme Tipleri' },
      { code: 'COĞ.9.5.1', unite: 'ÇEVRE VE TOPLUM', metin: 'COĞ.9.5.1. Doğal afetleri ve etkilerini değerlendirir.', konu_suggest: 'Doğal Afetler' },
      { code: 'COĞ.9.5.2', unite: 'ÇEVRE VE TOPLUM', metin: 'COĞ.9.5.2. Çevre sorunlarını ve temel çözüm yollarını açıklar.', konu_suggest: 'Çevre Sorunları ve Sürdürülebilirlik' },
    ],
    10: [
      { code: 'COĞ.10.1.1', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.1. Olay ve olguları coğrafi bakış açısıyla yorumlar.', konu_suggest: 'Coğrafi Bakış Açısı' },
      { code: 'COĞ.10.1.2', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.2. Coğrafya biliminin gelişim sürecini özetler.', konu_suggest: 'Coğrafyanın Gelişimi' },
      { code: 'COĞ.10.1.3', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.3. Coğrafi sorgulama sürecinde soru üretir ve veri kullanır.', konu_suggest: 'Coğrafi Sorgulama' },
      { code: 'COĞ.10.1.4', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.4. Mekânsal ilişkileri harita ve grafiklerle yorumlar.', konu_suggest: 'Mekânsal İlişkiler' },
      { code: 'COĞ.10.2.1', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.10.2.1. Mekânsal bilgi teknolojilerini temel düzeyde kullanır.', konu_suggest: 'Mekânsal Bilgi Teknolojileri' },
      { code: 'COĞ.10.2.2', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.10.2.2. Farklı harita türlerini okur ve yorumlar.', konu_suggest: 'Harita Okuma ve Yorumlama' },
      { code: 'COĞ.10.3.1', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.3.1. Yerkürenin tektonik yapısını ve etkilerini açıklar.', konu_suggest: 'Levha Tektoniği' },
      { code: 'COĞ.10.3.2', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.3.2. Aşınım ve birikim süreçlerinin yer şekillerine etkisini açıklar.', konu_suggest: 'Aşınım ve Birikim' },
      { code: 'COĞ.10.4.1', unite: 'BEŞERÎ SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.4.1. Yerleşmeleri fonksiyonlarına göre sınıflandırır.', konu_suggest: 'Yerleşme Tipleri' },
      { code: 'COĞ.10.5.1', unite: 'EKONOMİK FAALİYETLER VE ETKİLERİ', metin: 'COĞ.10.5.1. Ekonomik faaliyetleri sektörlere göre sınıflandırır.', konu_suggest: 'Ekonomik Sektörler' },
      { code: 'COĞ.10.6.1', unite: 'AFETLER VE SÜRDÜRÜLEBİLİR ÇEVRE', metin: 'COĞ.10.6.1. Afet bilinci ve hazırlık yollarını açıklar.', konu_suggest: 'Afet Bilinci' },
      { code: 'COĞ.10.7.1', unite: 'BÖLGELER, ÜLKELER VE KÜRESEL BAĞLANTILAR', metin: 'COĞ.10.7.1. Türk kültürü ile coğrafya arasındaki ilişkiyi değerlendirir.', konu_suggest: 'Türk Kültürü ve Coğrafya' },
    ],
  },
  matematik: {
    9: [
      { code: 'MAT.9.1.1', unite: 'Mantık', metin: 'MAT.9.1.1. Önermenin doğruluk değerini belirler.', konu_suggest: 'Önerme ve Doğruluk Değeri' },
      { code: 'MAT.9.1.2', unite: 'Mantık', metin: 'MAT.9.1.2. Bileşik önermeleri örneklerle açıklar.', konu_suggest: 'Bileşik Önermeler' },
      { code: 'MAT.9.1.3', unite: 'Mantık', metin: 'MAT.9.1.3. Koşullu önerme ve iki yönlü koşullu önermeyi örneklerle açıklar.', konu_suggest: 'Koşullu Önerme' },
      { code: 'MAT.9.2.1', unite: 'Kümeler', metin: 'MAT.9.2.1. Kümelerde birleşim, kesişim, fark ve tümleme işlemlerini yapar.', konu_suggest: 'Küme İşlemleri' },
      { code: 'MAT.9.2.2', unite: 'Kümeler', metin: 'MAT.9.2.2. İki kümenin kartezyen çarpımını açıklar.', konu_suggest: 'Kartezyen Çarpım' },
      { code: 'MAT.9.3.1', unite: 'Denklemler ve Eşitsizlikler', metin: 'MAT.9.3.1. Birinci dereceden bir bilinmeyenli denklemleri çözer.', konu_suggest: 'Denklem Çözme' },
      { code: 'MAT.9.3.2', unite: 'Denklemler ve Eşitsizlikler', metin: 'MAT.9.3.2. Birinci dereceden iki bilinmeyenli denklem sistemlerini çözer.', konu_suggest: 'Denklem Sistemleri' },
      { code: 'MAT.9.4.1', unite: 'Üçgenler', metin: 'MAT.9.4.1. Üçgenlerin eşliğini açıklar.', konu_suggest: 'Üçgenlerde Eşlik' },
      { code: 'MAT.9.4.2', unite: 'Üçgenler', metin: 'MAT.9.4.2. Üçgenlerin benzerliğini açıklar.', konu_suggest: 'Üçgenlerde Benzerlik' },
    ],
  },
};

/** Ders/sınıf için MEB kazanım listesi var mı? */
export function hasMebKazanimlar(subjectCode: string, grade: number): boolean {
  const list = CURRICULUM_KAZANIMLAR[subjectCode]?.[grade];
  return Array.isArray(list) && list.length > 0;
}

/** MEB kazanımlarını prompt için metin bloğuna çevir */
export function formatMebKazanimlarForPrompt(subjectCode: string, grade: number): string {
  const list = CURRICULUM_KAZANIMLAR[subjectCode]?.[grade];
  if (!list?.length) return '';
  return list
    .map((k) => {
      let s = `[${k.code}] ${k.unite}\n${k.metin}`;
      if (k.konu_suggest) s += `\n(Önerilen konu: ${k.konu_suggest})`;
      return s;
    })
    .join('\n\n');
}
