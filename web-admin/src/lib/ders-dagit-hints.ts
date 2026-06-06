/** Kurallar ve ayarlar — bilgi (i) açıklamaları */

export const RULE_KIND_HINTS: Record<'hard' | 'soft' | 'pedagogy', string> = {
  hard: 'Bu kurallar ihlal edilirse otomatik program üretimi başarısız olur veya slot yerleştirilemez. Kapatmadan önce neden zorunlu olduğunu okuyun.',
  soft: 'Tercih kuralları mümkün olduğunca uygulanır. Öncelik puanı yüksek olanlar, çakışan tercihlerde önce denenir; tam çözüm garantisi yoktur.',
  pedagogy: 'MEB ve okul pedagojisine uygun yerleşim. Beden/müzik günleri ve teorik–uygulamalı saat ayrımı bu gruptadır.',
};

export const RULE_HINTS: Record<string, string> = {
  no_teacher_clash:
    'Bir öğretmen aynı gün ve saatte yalnızca bir derste olabilir. Program üretimi ve manuel taşıma bu kuralı ihlal etmez.',
  no_class_clash:
    'Bir şube (sınıf) aynı anda iki farklı derste olamaz. Grup/bölünme dersleri paralel modda istisna tanımlanabilir.',
  class_weekly_capacity:
    'Her şubenin haftalık toplam ders saati, sınıf profilindeki kapasite ve atama toplamıyla uyumlu olmalıdır.',
  teacher_weekly_hours:
    'Öğretmenin atanan toplam saat, zorunlu ve ek ders üst sınırını aşamaz. Limitler Öğretmenler sayfasından gelir.',
  room_required:
    'Açıkken her atamanın en az bir derslik adayı olmalıdır. Derslik listesi boş atamalar uyarı verir.',
  fixed_slots:
    'Atamada sabitlenen gün/saatler üretim sırasında değiştirilmez; manuel düzenlemede kilitli slotlar korunur.',
  group_parallel_same_slot:
    'Bölünmüş sınıf/grup dersleri aynı saat diliminde paralel işlenir (farklı odalar veya alt şubeler).',
  building_travel_time:
    'Öğretmen veya sınıf ardışık derslerde farklı binadaysa, tanımlı dakika kadar boşluk bırakılır.',
  no_building_same_day:
    'Aynı gün içinde farklı binalarda ders vermeyi sınırlar; kampüsü geniş okullar için kullanılır.',
  distribute_week:
    'Aynı dersin saatleri mümkünse haftanın farklı günlerine yayılır; tek güne yığmayı azaltır.',
  two_same_day: 'Haftada 2 saatlik dersler mümkünse aynı günde ardışık veya yakın saatlerde toplanır.',
  max_one_per_day: 'Aynı ders şubeye günde en fazla bir kez konur (haftalık saat 5 ise 5 farklı gün).',
  max_two_per_day: 'Aynı ders bir günde en fazla 2 saat; fazlası başka güne kaydırılır.',
  min_two_per_day: 'Günde en az 2 saat aynı ders tercih edilir (blok ders mantığı).',
  two_not_consecutive_days: 'Haftada 2 saat varsa bu saatler art arda gelen günlerde olmamalıdır.',
  two_not_same_day: 'Haftada 2 saat varsa farklı günlerde olmalıdır (aynı günde toplanmaz).',
  two_two_day_gap: 'İki saat arasında en az bir boş gün tercih edilir (ör. Pazartesi–Çarşamba).',
  not_consecutive_same_hour: 'Aynı gün içinde bitişik ders saatlerine yerleştirilmez.',
  max_days_per_week_planning: 'Haftada en fazla belirtilen gün sayısında ders günü kullanılır.',
  max_same_period_week: 'Aynı ders sırası (ör. 2. saat) haftada en fazla X günde kullanılır.',
  no_compact_week: 'Haftalık saatler mümkün olduğunca günlere yayılır; az güne sıkıştırılmaz.',
  same_day_consecutive: 'Aynı gün içindeki çok saatli dersler mümkünse ardışık slotlarda tutulur.',
  four_plus_consecutive:
    'Bir öğretmen veya sınıf için günde 4’ten fazla kesintisiz ders saati oluşturulmaz.',
  important_early:
    'Seçili dersler (Planlama ilişkileri) veya kural açıkken tüm dersler için günün erken saatleri (1–6) tercih edilir; 7. saat ve sonrası engellenir.',
  minimize_teacher_gaps:
    'Öğretmenin gün içindeki boş ders saatleri (pencere) azaltılır; servis ve yorgunluk için.',
  minimize_work_days: 'Öğretmenin okula geldiği gün sayısı az tutulmaya çalışılır.',
  minimize_building_moves: 'Gün içinde bina/oda değiştirme sayısı azaltılır.',
  meb_pe_music_days:
    'Beden eğitimi ve müzik dersleri seçtiğiniz günlerde yoğunlaştırılır. Aşağıdaki gün seçicisi bu kurala bağlıdır.',
  meb_theory_am_practical_pm:
    'Teorik dersler sabah, atölye/uygulamalı dersler öğleden sonraya yerleştirilmeye çalışılır.',
};

export const RULE_ENGINE_SUMMARY = `Açık her kural üretimde zorunludur: ihlal varsa program kaydedilmez ve üretim durur; skor 100 yalnızca tüm saatler yerleşip açık kurallar sağlandığında verilir. Öğretmen/sınıf çakışması kapalı görünse de motor düzeyinde her zaman engellenir. “Sınıf haftalık kapasite” ön doğrulama ve profil limitidir. Plan Kartları yeni kural açabilir; zorunlu seçilip henüz desteklenmeyen ilişki varsa üretim başlamadan engellenir. Okul türüne göre beden/müzik ve teorik–uygulamalı kurallar otomatik etkinleşebilir.`;

export const RULE_EXTRA_HINTS = {
  scope:
    'Okul geneli varsayılan kurallar tüm şubelere uygulanır. Sınıf profili seçerseniz yalnızca o profildeki şubeler için istisna/ek kural kaydedilir.',
  peDays:
    'Salı–Perşembe gibi sabit günler MEB uygulamasında sık kullanılır. En az bir gün seçin; kaydetmeden üretim eski değeri kullanır.',
  travelDefault:
    'Bina kimliği bilinmeyen geçişler için varsayılan dakika. Kampüste tek bina varsa genelde 5 dk yeterlidir.',
  travelMatrix:
    'İki bina arası özel süre tanımlayın (ör. A binası → spor salonu 10 dk). Matris, bina geçiş kuralı açıkken kullanılır.',
  planningLink:
    'Plan Kartı ilişkileri (öğretmen X ile Y aynı gün, ders Z önce vb.) buradan yönetilir; zorunlu seçilenler üretimde özellikle doğrulanır.',
  weight:
    '1–20 arası öncelik. Yüksek puanlı tercih, düşük puanlıya göre önce sağlanmaya çalışılır; hepsi aynı anda mümkün olmayabilir.',
};

export type SettingHint = {
  title: string;
  short: string;
  detail: string;
};

export const SETTING_HINTS: Record<string, SettingHint> = {
  kurulum: {
    title: 'Kurulum',
    short: 'Okul türü, sınıf profilleri ve veri özeti.',
    detail:
      'Program merkezinin başlangıç ekranı: okul profili (AİHL, lise vb.), şube listesi, hızlı özet ve öğretmen senkronu. Diğer sayfaların ön koşulu burada tamamlanır.',
  },
  donem: {
    title: 'Dönem ve saatler',
    short: 'Çalışma günleri, öğle arası, ikili eğitim.',
    detail:
      'Haftada hangi günlerde ders yapılacağı, günlük ders sayısı, öğle arası (uzun mola) ve ikili öğretim ayarları. Üretim motoru yalnızca bu gün/saat ızgarasını kullanır.',
  },
  'sinif-saatleri': {
    title: 'Sınıf saatleri',
    short: 'Şube bazlı zaman tablosu ve kapasite.',
    detail:
      'Her şube için günlük max ders, haftalık min/max ve özel kapalı slotlar. Sınıf profili genel kurallarını şube düzeyinde inceltir.',
  },
  ogretmenler: {
    title: 'Öğretmenler',
    short: 'Müsaitlik ve limitler.',
    detail:
      'Zorunlu/ek haftalık saat, günlük max, çalışma günü sayısı, müsait olmadığı slotlar ve öğle arası boşluk izni. Adalet ve üretim bu limitlere uyar.',
  },
  ayarlar: {
    title: 'Ayarlar',
    short: 'Modül sayfalarına kısayollar.',
    detail: 'Kurulum, ders verisi, kurallar ve program adımlarına tek listeden gidilir.',
  },
  'ogretmen-tercihleri': {
    title: 'Başvurular ve önizleme',
    short: 'Öğretmen bazlı tercih inceleme.',
    detail:
      'Müsaitlik toplama penceresini açıp kapatabilir, onay zorunluluğunu seçebilirsiniz. Bekleyen başvurular burada onaylanır; öğretmen ızgarasını önizleyebilirsiniz.',
  },
  dersler: {
    title: 'Dersler',
    short: 'Katalog ve TTKB planı.',
    detail:
      'Branş dersleri ve şube başına haftalık saat planı. TTKB’den içe aktarım veya manuel katalog; atamalar bu kataloga dayanır.',
  },
  aktarim: {
    title: 'İçe / dışa aktar',
    short: 'aSc XML, e-Okul/Bilsa Excel, JSON stüdyo yedeği.',
    detail:
      'Dışa aktarma: tüm stüdyo verisi (ders, atama, grup) JSON olarak. İçe aktarma: aSc Timetables 2012 XML; Bilsa ve benzeri programlardan Excel çarşaf (e-Okul ızgara modu); ÖğretmenPro yedek geri yükleme. Program çizelgesi Raporlar üzerinden ayrı dışa aktarılır.',
  },
  gruplar: {
    title: 'Gruplar',
    short: 'Paralel şube, alt grup ve meslek atölyesi modları — okul türüne göre önerilir.',
    detail:
      'Paralel odalar, alt şubeler (5A-A / 5A-B) ve çok sınıflı öğretmen senaryoları. İki haftada bir dersler grup ile eşleştirilir.',
  },
  secmeli: {
    title: 'Seçmeli',
    short: 'Seçmeli ders havuzları.',
    detail:
      'Öğrenci seçimine göre açılan ders paketleri ve havuz başına kontenjan. Atama ve üretimde seçmeli şubeler ayrı işlenir.',
  },
  derslikler: {
    title: 'Derslikler',
    short: 'Oda listesi ve kapasite.',
    detail:
      'Derslik/bina tanımları, atamalara uygun oda listesi ve planlama ilişkilerinde oda kısıtları. “Derslik zorunlu” kuralı açıksa boş liste uyarı verir.',
  },
  atamalar: {
    title: 'Atamalar',
    short: 'Ders–öğretmen–şube eşlemesi.',
    detail:
      'Hangi öğretmenin hangi şubede hangi dersi kaç saat vereceği. Sabit slot, bölünme, derslik ve iki haftada bir seçenekleri burada.',
  },
  'planlama-iliskileri': {
    title: 'Planlama ilişkileri',
    short: 'Plan Kartı kuralları ve kısıtlar.',
    detail:
      'Kartlar arası ilişkiler (aynı gün, önce/sonra, birlikte). Strict ve desteklenmeyen kurallar doğrulamada üretimi engelleyebilir.',
  },
  kurallar: {
    title: 'Kurallar',
    short: 'Zorunlu ve tercih kuralları.',
    detail:
      'Üretim motorunun sert ve yumuşak kısıtları. Okul veya sınıf profili kapsamında açıp kapatabilir, tercih önceliği verebilirsiniz.',
  },
  dogrulama: {
    title: 'Doğrulama',
    short: 'Ön kontrol ve eksikler.',
    detail:
      'Üretim öncesi tüm şartların kontrol listesi: şube, dönem, atama, öğretmen yükü, planlama kuralları ve nöbet çakışması.',
  },
  uret: {
    title: 'Program oluştur',
    short: 'Otomatik dağıtım.',
    detail:
      'CSP/yerel arama ile 1–3 program versiyonu üretir. Doğrulama temiz olmadan üretim başlamaz; süre ve versiyon sayısı seçilebilir.',
  },
  program: {
    title: 'Program tablosu',
    short: 'Düzenleme, yazdırma, sürükle-bırak.',
    detail:
      'Üretilen programı sınıf/öğretmen/derslik görünümünde düzenleme, çakışma uyarısı ve yazdırma. Manuel değişiklikler kaydedilir.',
  },
  'ogretmen-program': {
    title: 'Öğretmen programı',
    short: 'Tüm öğretmenler — matris görünümü.',
    detail:
      'Tüm öğretmenlerin haftalık programını tek tabloda gösterir; baskı ve denge kontrolü için uygundur.',
  },
  yayin: {
    title: 'Yayın',
    short: 'Veli görünümü ve paylaşım.',
    detail:
      'Programı okul ders programı modülüne aktarma, veli PDF ve paylaşım linkleri. Yayın sonrası öğretmen/veli ekranları güncellenir.',
  },
  arsiv: {
    title: 'Arşiv',
    short: 'Eski program sürümleri.',
    detail:
      'Önceki üretim/yayın sürümlerini listeler; karşılaştırma veya geri yükleme için referans.',
  },
  adalet: {
    title: 'Adalet',
    short: 'Öğretmen yükü ve dağılım dengesi.',
    detail:
      'Öğretmen başına saat, boşluk ve Pzt–Cum dağılımı; ortalamadan sapma ve adalet skoru. İdare içi denge kontrolü.',
  },
};

export function settingHintKeyFromHref(href: string): string {
  const path = href.split('?')[0] ?? href;
  const seg = path.split('/').filter(Boolean).pop() ?? '';
  return seg;
}

export function ruleHint(key: string, fallback?: string): string {
  return RULE_HINTS[key] ?? fallback ?? 'Bu kural üretim ve manuel düzenlemede dikkate alınır.';
}
