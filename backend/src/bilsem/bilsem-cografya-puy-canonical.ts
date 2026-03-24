/**
 * Coğrafya PÜY PDF seed ile aynı UTF-8 metinler (sort_order 0..36).
 * DB yanlış kodlamayla import edildiğinde okumada onarım için kullanılır.
 */
export type BilsemCografyaPuyCanonRow = {
  code: string;
  description: string;
  unite: string;
  konu: string;
  surecBilesenleri: string;
};

export const BILSEM_COG_PUY_CANON_BY_SORT: BilsemCografyaPuyCanonRow[] = [
  {
    code: 'COĞ.PÜY.1.1',
    description: 'Bilgi türlerini ve kullanımlarını sorgulayabilme.',
    unite: 'Bilim ve Bilim Felsefesi',
    konu: 'Bilgi türleri ve kullanımı',
    surecBilesenleri:
      'Bilgi türlerini tanımlama; soru sorma; bilgi toplama; doğruluğu değerlendirme; çıkarım yapma.',
  },
  {
    code: 'COĞ.PÜY.1.2–1.3',
    description: 'Toplumun farklı katmanlarında bilimin üretilmesini tahmin ve tartışabilme.',
    unite: 'Bilim ve Bilim Felsefesi',
    konu: 'Toplumun farklı katmanlarında bilim',
    surecBilesenleri:
      'Gözlem/deneyim ilişkilendirme; çıkarım ve yargı; mantıksal temellendirme ve tartışma.',
  },
  {
    code: 'COĞ.PÜY.1.4',
    description: 'Bilimin gelişimi açısından bilimsel paradigmaları sınıflandırabilme.',
    unite: 'Bilim ve Bilim Felsefesi',
    konu: 'Bilimsel paradigmalar',
    surecBilesenleri: 'Nitelikleri belirleme; ayrıştırma; gruplandırma; etiketleme.',
  },
  {
    code: 'COĞ.PÜY.2.1–2.2',
    description:
      'Bilimsel araştırmalarda etik kavramını sorgulama; araştırma ve yayın ahlakında eleştirel düşünme.',
    unite: 'Bilim ve Etik',
    konu: 'Bilimsel araştırma ve yayın ahlakı (etik eğitimi)',
    surecBilesenleri:
      'Etik kavramı; 5N1K ile soru; bilgi toplama ve değerlendirme; akıl yürütme ve yansıtma.',
  },
  {
    code: 'COĞ.PÜY.2.3',
    description: 'Etik ihlallere karşı alınan önlemleri sorgulayabilme.',
    unite: 'Bilim ve Etik',
    konu: 'Etik ihlallere karşı alınan önlemler',
    surecBilesenleri: 'Tanımlama; soru sorma; bilgi toplama; doğruluk değerlendirme; çıkarım.',
  },
  {
    code: 'COĞ.PÜY.3.1',
    description: 'Proje tabanlı öğrenmenin bileşenlerini çözümleyebilme.',
    unite: 'Proje Tabanlı Öğrenme',
    konu: 'Proje tabanlı öğrenmenin bileşenleri',
    surecBilesenleri: 'Bileşenleri belirleme; bileşenler arası ilişkiyi belirleme.',
  },
  {
    code: 'COĞ.PÜY.3.2',
    description: 'Proje tabanlı öğrenmenin faydalarını sorgulayabilme.',
    unite: 'Proje Tabanlı Öğrenme',
    konu: 'Proje tabanlı öğrenmenin faydaları',
    surecBilesenleri: 'Tanımlama; soru sorma; bilgi toplama; doğruluk değerlendirme; çıkarım.',
  },
  {
    code: 'COĞ.PÜY.3.3–3.4',
    description: 'PÖ\'nün girişimciliğe etkisini yapılandırma ve yorumlama.',
    unite: 'Proje Tabanlı Öğrenme',
    konu: 'Proje tabanlı öğrenmede girişimcilik',
    surecBilesenleri:
      'Nedensel ilişkiler; bütünleştirme; inceleme ve dönüştürme; kendi cümleleriyle aktarma.',
  },
  {
    code: 'COĞ.PÜY.3.5',
    description: 'PÖ bağlamında SMK ve FSEK\'teki hakların yerini yapılandırabilme.',
    unite: 'Proje Tabanlı Öğrenme',
    konu: 'Sınai Mülkiyet ve Fikir-Sanat Eserleri Kanunu',
    surecBilesenleri: 'Hakların yeri ve önemini inceleme; bilgileri bütünleştirme.',
  },
  {
    code: 'COĞ.PÜY.4.1',
    description: 'Araştırma projelerini sınıflandırabilme.',
    unite: 'Proje Türleri / Araştırma projeleri',
    konu: 'Araştırma projelerine ilişkin ölçütler',
    surecBilesenleri: 'Ölçüt belirleme; nesne/olgu ayrıştırma; tasnif; etiketleme.',
  },
  {
    code: 'COĞ.PÜY.4.2',
    description: 'Bilimsel araştırma projelerinin özelliklerini karşılaştırabilme.',
    unite: 'Bilimsel araştırma projeleri ve özellikleri',
    konu: 'Bilimsel araştırma projelerinin özellikleri',
    surecBilesenleri: 'Özellikleri belirleme; benzerlik ve farkları listeleme.',
  },
  {
    code: 'COĞ.PÜY.4.3',
    description: 'Bilimsel araştırma dışı proje türlerinin özelliklerini karşılaştırabilme.',
    unite: 'Diğer proje türleri',
    konu: 'Diğer proje türleri ve özellikleri',
    surecBilesenleri: 'Tür ve özellikleri belirleme; benzerlik ve farkları listeleme.',
  },
  {
    code: 'COĞ.PÜY.4.4',
    description: 'Bilimsel araştırma projeleri ile diğer proje çeşitlerini karşılaştırabilme.',
    unite: 'Araştırma projeleri',
    konu: 'Proje çeşitlerinin karşılaştırılması',
    surecBilesenleri: 'Belirleme; benzerlik ve farkları listeleme.',
  },
  {
    code: 'COĞ.PÜY.4.5–4.6',
    description: 'Bilimsel ve diğer proje özelliklerini sentezleyebilme.',
    unite: 'Diğer proje türleri ve özellikleri',
    konu: 'Özelliklerin sentezi',
    surecBilesenleri: 'İlişki kurma; özgün bütün oluşturma.',
  },
  {
    code: 'COĞ.PÜY.5.1',
    description: 'Geçmişte yaşanmış coğrafi sorunları çözümleyebilme.',
    unite: 'Öğrencilerin coğrafi ilgilerini keşfetmeleri',
    konu: 'Geçmişte yaşanmış coğrafi sorunların analizi',
    surecBilesenleri: 'Bileşenleri ve bileşenler arası ilişkileri belirleme.',
  },
  {
    code: 'COĞ.PÜY.5.2',
    description: 'Günümüzde yaşanan coğrafi sorunları çözümleyebilme.',
    unite: 'Öğrencilerin coğrafi ilgilerini keşfetmeleri',
    konu: 'Günümüzde yaşanan coğrafi sorunların analizi',
    surecBilesenleri: 'Bileşenleri ve ilişkileri belirleme.',
  },
  {
    code: 'COĞ.PÜY.5.3–5.4',
    description: 'Gelecekte yaşanabilecek coğrafi sorunları veriye dayalı tahmin ve tartışabilme.',
    unite: 'Öğrencilerin coğrafi ilgilerini keşfetmeleri',
    konu: 'Gelecekte yaşanabilecek coğrafi sorunlar',
    surecBilesenleri:
      'Veri toplama; projeksiyon; yargı; mantıksal temellendirme ve tartışma.',
  },
  {
    code: 'COĞ.PÜY.6.1–6.2',
    description: 'Literatürden bilgi toplayıp özetteyebilme (konu tespiti).',
    unite: 'Proje konusu belirlemede özgünlük',
    konu: 'Literatür tarama ve konu seçimi',
    surecBilesenleri:
      'Araç belirleme; kaynak bulma; doğrulama; kayıt; çözümleme ve özetleme.',
  },
  {
    code: 'COĞ.PÜY.6.3–6.4',
    description: 'Özgün proje konusuna karar verme ve özgünlüğü değerlendirme.',
    unite: 'Proje konusu belirlemede özgünlük',
    konu: 'Proje konusunun özgünlüğünü test etme',
    surecBilesenleri:
      'Amaç; bilgi; alternatifler; mantıksal denetleme; ölçüt ve ölçme.',
  },
  {
    code: 'COĞ.PÜY.6.5',
    description: 'Proje paydaşlarını belirlerken sorgulama yapabilme.',
    unite: 'Proje konusu belirlemede özgünlük',
    konu: 'Proje paydaşlarının belirlenmesi',
    surecBilesenleri: 'Tanımlama; soru; bilgi toplama; doğruluk; çıkarım.',
  },
  {
    code: 'COĞ.PÜY.6.6',
    description:
      'İhtiyaç durumuna göre ortak ve/veya faydalanıcıları belirlemede sorgulama.',
    unite: 'Proje konusu belirlemede özgünlük',
    konu: 'Ortaklar ve faydalanıcılar',
    surecBilesenleri: 'Tanımlama; soru; bilgi toplama; doğruluk; çıkarım.',
  },
  {
    code: 'COĞ.PÜY.7.1–7.2',
    description:
      'İş paketleri/zaman çizelgelerinde iş birliği; gerektiğinde bütçe bileşenlerine karar verme.',
    unite: 'Proje planı ve iş takvimi',
    konu: 'Proje planı, iş takvimi ve bütçe',
    surecBilesenleri: 'Kronolojik sıralama; bütçe amaç ve alternatifleri; yansıtma.',
  },
  {
    code: 'COĞ.PÜY.8.1–8.2',
    description: 'Giriş bölümü için literatürden bilgi; hipotez yapılandırma.',
    unite: 'Projenin hazırlanması, geliştirilmesi ve sonuçlandırılması',
    konu: 'Projenin giriş bölümünün yazılması',
    surecBilesenleri: 'Kaynak bulma; analiz ve alt başlıklar; problem ve hipotez.',
  },
  {
    code: 'COĞ.PÜY.8.3–8.5',
    description:
      'Bilimsel araştırma yöntemlerinin önemini çözümleme; nicel ve nitel araştırmaları sorgulama.',
    unite: 'Projede kullanılacak bilimsel araştırma deseni',
    konu: 'Bilimsel araştırma yöntemleri (nicel–nitel)',
    surecBilesenleri: 'Parçalar ve ilişkiler; sorgulama süreçleri.',
  },
  {
    code: 'COĞ.PÜY.8.7–8.8',
    description: 'Karma araştırmaları sorgulama; desene karar verme.',
    unite: 'Projede kullanılacak bilimsel araştırma deseni',
    konu: 'Karma araştırma ve desen seçimi',
    surecBilesenleri:
      'Bilgi toplama; alternatifler; mantıksal denetleme; seçim ve yansıtma.',
  },
  {
    code: 'COĞ.PÜY.8.9',
    description: 'Evren, örneklem veya çalışma grubuna karar verebilme.',
    unite: 'Projede kullanılacak bilimsel araştırma deseni',
    konu: 'Evren, örneklem veya çalışma grubu',
    surecBilesenleri: 'Amaç; bilgi; alternatifler; denetim; seçim; yansıtma.',
  },
  {
    code: 'COĞ.PÜY.8.10–8.11',
    description: 'Veri toplama araçlarına karar verme ve veri toplama.',
    unite: 'Projede veri toplama ve analizi',
    konu: 'Veri toplama araçları ve uygulama',
    surecBilesenleri: 'Amaç; bilgi; seçenekler; toplama ve kayıt.',
  },
  {
    code: 'COĞ.PÜY.8.12–8.14',
    description: 'Analiz araçlarını sorgulama; veriyi çözümleme ve sınıflandırma.',
    unite: 'Projede veri toplama ve analizi',
    konu: 'Veri analizi ve sınıflandırma',
    surecBilesenleri:
      'SPSS/Nvivo vb. sorgulama; parça ve ilişkiler; değişken ve tasnif.',
  },
  {
    code: 'COĞ.PÜY.8.15–8.16',
    description: 'Bulguları yapılandırma; tablo, grafik ve diyagram hazırlama.',
    unite: 'Projedeki bulgu ve yorumlar',
    konu: 'Bulguların yapılandırılması ve görselleştirilmesi',
    surecBilesenleri: 'İlişkiler; görselleştirme adımları.',
  },
  {
    code: 'COĞ.PÜY.8.17',
    description: 'Bulguları yorumlayabilme.',
    unite: 'Projedeki bulgu ve yorumlar',
    konu: 'Bulguların yorumlanması',
    surecBilesenleri: 'İnceleme; dönüştürme; nesnel yeniden ifade.',
  },
  {
    code: 'COĞ.PÜY.8.18–8.19',
    description: 'Sonuçları diğer çalışmalarla karşılaştırma; tartışmaları değerlendirme.',
    unite: 'Projenin tartışma, sonuç ve öneriler bölümü',
    konu: 'Karşılaştırma ve tartışma değerlendirmesi',
    surecBilesenleri: 'Ölçüt; ölçme; karşılaştırma ve yargı.',
  },
  {
    code: 'COĞ.PÜY.8.20',
    description: 'Paydaşlara yönelik önerileri yapılandırabilme.',
    unite: 'Projenin tartışma, sonuç ve öneriler bölümü',
    konu: 'Önerilerin yapılandırılması',
    surecBilesenleri: 'İlişki kurarak öneri ve bütünleştirme.',
  },
  {
    code: 'COĞ.PÜY.9.1',
    description: 'Sunum için teknolojik araçlara karar verebilme.',
    unite: 'Proje için etkili sunum teknikleri',
    konu: 'Görsel materyaller ve sunum araçları',
    surecBilesenleri: 'Amaç; bilgi; alternatifler; seçim; yansıtma.',
  },
  {
    code: 'COĞ.PÜY.9.2',
    description: 'Sözlü sunumu eyleme dönüştürebilme.',
    unite: 'Proje için etkili sunum teknikleri',
    konu: 'Sözlü sunum hazırlama',
    surecBilesenleri: 'Planlama; uygulama; değerlendirme.',
  },
  {
    code: 'COĞ.PÜY.10.1–10.3',
    description:
      'Bilimsel platformda eyleme dönüştürme; yaygınlaştırma araçları; yayın.',
    unite: 'Proje çıktılarının ürüne dönüştürülmesi',
    konu: 'Yaygınlaştırma ve yayın',
    surecBilesenleri: 'Plan; uygulama; değerlendirme; yayın oluşturma ve tanıtma.',
  },
  {
    code: 'COĞ.PÜY.11.1',
    description: 'Proje çıktılarını uygun eserle sonuçlandırabilme.',
    unite: 'Proje çıktılarının ürüne dönüştürülmesi',
    konu: 'Çıktıların ürüne dönüştürülmesi',
    surecBilesenleri: 'Eser oluşturma; tanıtma; değerlendirme.',
  },
  {
    code: 'COĞ.PÜY.11.2–11.3',
    description:
      'Eserleri yaygınlaştıracak araçlara karar verme ve bilimsel platformda eyleme dönüştürme (Sınai Mülkiyet).',
    unite: 'Proje çıktılarının ürüne dönüştürülmesi',
    konu: 'Sınai Mülkiyet Kanunu kapsamında koruma',
    surecBilesenleri: 'Araç seçimi; plan; uygulama; değerlendirme.',
  },
];

export function repairBilsemCografyaPuyItemIfCorrupt(
  item: {
    sortOrder: number;
    code: string | null;
    description: string;
    unite: string | null;
    konu: string | null;
    surecBilesenleri: string | null;
  },
): void {
  const so = item.sortOrder;
  if (so < 0 || so >= BILSEM_COG_PUY_CANON_BY_SORT.length) return;
  const canon = BILSEM_COG_PUY_CANON_BY_SORT[so];
  const joined = `${item.code ?? ''}\n${item.description}\n${item.unite ?? ''}\n${item.konu ?? ''}\n${item.surecBilesenleri ?? ''}`;
  const looksCorrupt =
    joined.includes('?') ||
    (item.code?.startsWith('CO') === true &&
      item.code.includes('P') &&
      item.code.includes('Y') &&
      !item.code.includes('Ğ'));
  if (looksCorrupt) {
    item.code = canon.code;
    item.description = canon.description;
    item.unite = canon.unite;
    item.konu = canon.konu;
    item.surecBilesenleri = canon.surecBilesenleri;
    return;
  }
  // Encoding temiz ama eksik alanları kanonik veriden doldur
  if (!item.unite?.trim() && canon.unite) item.unite = canon.unite;
  if (!item.konu?.trim() && canon.konu) item.konu = canon.konu;
  if (!item.surecBilesenleri?.trim() && canon.surecBilesenleri)
    item.surecBilesenleri = canon.surecBilesenleri;
}
