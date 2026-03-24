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
      { code: 'COĞ.9.1.1', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.1. Coğrafya biliminin konusu ve bölümlerini çözümleyebilme\na) Coğrafya biliminin konusu ve bölümlerini oluşturan bileşenleri belirler.\nb) Bileşenler arasındaki ilişkileri belirler.', konu_suggest: 'Coğrafya Biliminin Konusu ve Bölümleri' },
      { code: 'COĞ.9.1.2', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.2. Mekânsal düşünme ile coğrafya öğrenmenin önemini çözümleyebilme\na) Mekânda gerçekleşen coğrafi olay, olgu veya konuyu belirler.\nb) Coğrafya öğrenmenin önemi arasındaki ilişkiyi belirler.', konu_suggest: 'Niçin Coğrafya Öğrenmeliyiz?' },
      { code: 'COĞ.9.1.3', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.9.1.3. Coğrafya biliminin gelişimi hakkında bilgi toplayabilme\na) Gerekli bilgilere ulaşmak için kullanacağı araçları belirler.\nb) Bilgileri doğrular ve kaydeder.', konu_suggest: 'Coğrafya Biliminin Gelişimi' },
      { code: 'COĞ.9.2.1', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.9.2.1. Harita uygulamaları yapabilme\na) Haritaya ait bileşenlerden yararlanarak haritaları okur.\nb) Haritadaki olay, olgu ve mekânlar arası ilişkileri çözümler.\nç) Harita yapım aşamalarını kullanarak harita oluşturur.', konu_suggest: 'Mekânın Aynası Haritalar' },
      { code: 'COĞ.9.2.2', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: "COĞ.9.2.2. Türkiye'nin konum özelliklerini algılayabilme\na) Türkiye'nin konum özelliklerini belirler.\nb) Konum özelliklerini görselleştirir.\nc) Konum özelliklerini özetler.", konu_suggest: "Türkiye'nin Coğrafi Konumu" },
      { code: 'COĞ.9.2.3', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.9.2.3. Mekânsal bilgi teknolojilerini oluşturan bileşenleri çözümleyebilme\na) Bileşenleri belirler.\nb) Bileşenler arasındaki ilişkileri belirler.', konu_suggest: 'Mekânsal Bilgi Teknolojilerinin Bileşenleri' },
      { code: 'COĞ.9.3.1', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.1. Hava olaylarını günlük hayatla ilişkilendirebilme\na) Hava olaylarını tanımlar.\nb) Hava olaylarının günlük hayata etkilerini değerlendirir.', konu_suggest: 'Hava Olayları ve Günlük Hayata Etkileri' },
      { code: 'COĞ.9.3.2', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.2. İklim elemanlarını analiz edebilme\na) İklim elemanlarını belirler.\nb) İklim elemanları arasındaki ilişkileri açıklar.', konu_suggest: 'İklim Elemanları' },
      { code: 'COĞ.9.3.3', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.3. Türkiye iklimini değerlendirebilme\na) Türkiye iklim tiplerini sınıflandırır.\nb) İklimin etkilerini yorumlar.', konu_suggest: 'Türkiye İklimi' },
      { code: 'COĞ.9.3.4', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.4. Yer şekillerinin oluşum süreçlerini açıklayabilme\na) İç ve dış kuvvetleri belirler.\nb) Yer şekillerinin oluşumundaki etkilerini değerlendirir.', konu_suggest: 'Yer Şekillerinin Oluşumu' },
      { code: 'COĞ.9.3.5', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: "COĞ.9.3.5. Türkiye'deki yer şekillerini analiz edebilme\na) Türkiye'deki yer şekillerini sınıflandırır.\nb) Yer şekillerinin dağılışını yorumlar.", konu_suggest: "Türkiye'de Yer Şekilleri" },
      { code: 'COĞ.9.3.6', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.9.3.6. Su kaynaklarını değerlendirebilme\na) Su kaynaklarının dağılışını açıklar.\nb) Su kullanımı ve çevre ilişkisini değerlendirir.', konu_suggest: 'Su Kaynakları ve Önemi' },
      { code: 'COĞ.9.4.1', unite: 'BEŞERÎ SİSTEMLER', metin: 'COĞ.9.4.1. Nüfus özelliklerini analiz edebilme\na) Nüfus özelliklerini belirler.\nb) Nüfus dağılışını yorumlar.', konu_suggest: 'Nüfus ve Yerleşme' },
      { code: 'COĞ.9.4.2', unite: 'BEŞERÎ SİSTEMLER', metin: 'COĞ.9.4.2. Yerleşme tiplerini değerlendirebilme\na) Yerleşme tiplerini sınıflandırır.\nb) Yerleşmelerin özelliklerini açıklar.', konu_suggest: 'Yerleşme Tipleri' },
      { code: 'COĞ.9.5.1', unite: 'ÇEVRE VE TOPLUM', metin: 'COĞ.9.5.1. Doğal afetleri değerlendirebilme\na) Doğal afetleri tanımlar.\nb) Doğal afetlerin etkilerini analiz eder.', konu_suggest: 'Doğal Afetler' },
      { code: 'COĞ.9.5.2', unite: 'ÇEVRE VE TOPLUM', metin: 'COĞ.9.5.2. Çevre sorunlarını çözümleyebilme\na) Çevre sorunlarını belirler.\nb) Çevre sorunlarına çözüm önerileri geliştirir.', konu_suggest: 'Çevre Sorunları ve Sürdürülebilirlik' },
    ],
    10: [
      { code: 'COĞ.10.1.1', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.1. Coğrafi bakış açısı ile olay ve olguları çözümleyebilme\na) Coğrafi bakış açısının temel özelliklerini belirler.\nb) Olay ve olguları coğrafi bakış açısı ile ilişkilendirir.', konu_suggest: 'Coğrafi Bakış Açısı' },
      { code: 'COĞ.10.1.2', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.2. Coğrafya biliminin gelişim sürecini değerlendirebilme\na) Coğrafya biliminin gelişim aşamalarını açıklar.\nb) Gelişim sürecindeki etkili faktörleri analiz eder.', konu_suggest: 'Coğrafya Biliminin Gelişimi' },
      { code: 'COĞ.10.1.3', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.3. Coğrafi sorgulama becerisi geliştirebilme\na) Coğrafi sorular üretir.\nb) Veri toplama ve analiz yöntemlerini uygular.', konu_suggest: 'Coğrafi Sorgulama' },
      { code: 'COĞ.10.1.4', unite: 'COĞRAFYANIN DOĞASI', metin: 'COĞ.10.1.4. Mekânsal ilişkileri yorumlayabilme\na) Mekânsal ilişkileri belirler.\nb) İlişkileri harita ve grafiklerle sunar.', konu_suggest: 'Mekânsal İlişkiler' },
      { code: 'COĞ.10.2.1', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.10.2.1. Mekânsal bilgi teknolojilerini kullanabilme\na) Harita ve uzaktan algılama verilerini analiz eder.\nb) Coğrafi bilgi sistemlerini kullanarak mekânsal veri üretir.', konu_suggest: 'Mekânsal Bilgi Teknolojileri' },
      { code: 'COĞ.10.2.2', unite: 'MEKÂNSAL BİLGİ TEKNOLOJİLERİ', metin: 'COĞ.10.2.2. Harita okuma ve yorumlama becerisi geliştirebilme\na) Farklı harita türlerini okur ve yorumlar.\nb) Haritalardan sonuç çıkarır.', konu_suggest: 'Harita Okuma ve Yorumlama' },
      { code: 'COĞ.10.3.1', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.3.1. Yerkürenin tektonik yapısını çözümleyebilme\na) Levha tektoniği kuramını açıklar.\nb) İç ve dış kuvvetlerin yer şekillerine etkisini değerlendirir.', konu_suggest: 'Levha Tektoniği' },
      { code: 'COĞ.10.3.2', unite: 'DOĞAL SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.3.2. Yeryüzü şekillerinin oluşumunu aşınım ve birikim süreçleri açısından inceleyebilme\na) Aşınım ve birikim süreçlerini açıklar.\nb) Yer şekillerinin oluşumundaki rolünü değerlendirir.', konu_suggest: 'Aşınım ve Birikim' },
      { code: 'COĞ.10.4.1', unite: 'BEŞERÎ SİSTEMLER VE SÜREÇLER', metin: 'COĞ.10.4.1. Yerleşmeleri fonksiyonlarına göre sınıflayabilme\na) Yerleşme tiplerini belirler.\nb) Yerleşmelerin gelişim faktörlerini analiz eder.', konu_suggest: 'Yerleşme Tipleri' },
      { code: 'COĞ.10.5.1', unite: 'EKONOMİK FAALİYETLER VE ETKİLERİ', metin: 'COĞ.10.5.1. Ekonomik faaliyetleri sektörlere göre sınıflandırabilme\na) Birincil, ikincil ve üçüncül sektörleri ayırt eder.\nb) Ülkelerin gelişmişlik düzeyini sektörel yapıya göre yorumlar.', konu_suggest: 'Ekonomik Sektörler' },
      { code: 'COĞ.10.6.1', unite: 'AFETLER VE SÜRDÜRÜLEBİLİR ÇEVRE', metin: 'COĞ.10.6.1. Afet bilinci oluşturabilme\na) Afet türlerini sınıflandırır.\nb) Afet önleme ve hazırlık yöntemlerini değerlendirir.', konu_suggest: 'Afet Bilinci' },
      { code: 'COĞ.10.7.1', unite: 'BÖLGELER, ÜLKELER VE KÜRESEL BAĞLANTILAR', metin: 'COĞ.10.7.1. Türk kültürünün coğrafi önemini değerlendirebilme\na) Kültürel mirasın coğrafi dağılışını açıklar.\nb) Kültür-coğrafya ilişkisini analiz eder.', konu_suggest: 'Türk Kültürü ve Coğrafya' },
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
