/**
 * Bilsem takvim şablonu – sürükle-bırak palet öğeleri.
 * Haftalara sürüklenebilir hızlı ekleme öğeleri.
 */

export type BilsemItemType = 'belirli_gun_hafta' | 'dep' | 'tanilama' | 'diger';

export interface BilsemPaletteItem {
  type: BilsemItemType;
  title: string;
}

export const BILSEM_PALETTE: BilsemPaletteItem[] = [
  { type: 'belirli_gun_hafta', title: 'İlköğretim Haftası' },
  { type: 'belirli_gun_hafta', title: 'Cumhuriyet Bayramı' },
  { type: 'belirli_gun_hafta', title: 'Atatürk Haftası' },
  { type: 'belirli_gun_hafta', title: 'Öğretmenler Günü ve Öğretmenler Haftası' },
  { type: 'belirli_gun_hafta', title: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı' },
  { type: "belirli_gun_hafta", title: "19 Mayıs Atatürk'ü Anma Gençlik ve Spor Bayramı" },
  { type: 'belirli_gun_hafta', title: 'Dünya Çocuk Hakları Günü' },
  { type: 'belirli_gun_hafta', title: 'Kütüphaneler Haftası' },
  { type: 'dep', title: 'Destek, BYF, ÖYG ve PROJE EĞİTİMİ Programlarının hazırlanması' },
  { type: 'dep', title: 'Destek, BYF, ÖYG ve PROJE EĞİTİMİ Programlarının uygulanması' },
  { type: 'dep', title: 'Destek Eğitimi ve Bireysel Yetenekleri Fark Ettirme çalışmaları' },
  { type: 'dep', title: 'Proje grubu çalışmaları' },
  { type: 'dep', title: 'Proje Sunum Haftası' },
  { type: 'tanilama', title: 'Proje Konularının Öğrencilere Dağıtılması' },
  { type: 'tanilama', title: 'Danışman öğretmenlerce aile ziyaretlerine başlanması' },
  { type: 'tanilama', title: 'Grup Taramalarının Başlaması' },
  { type: 'tanilama', title: 'Bireysel değerlendirmelerin yapılması' },
  { type: 'diger', title: 'Velilere yönelik bilgilendirme toplantısı' },
  { type: 'diger', title: 'Kayıt yenileme işlemleri' },
  { type: 'diger', title: 'Kurum içi koordinasyon toplantıları' },
  { type: 'diger', title: 'Stratejik Planın gözden geçirilmesi' },
  { type: 'diger', title: 'Yıl sonu evrak işlemleri' },
];
