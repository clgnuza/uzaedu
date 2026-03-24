/**
 * MEB müfredat ünite referansları – GPT taslak için.
 * Ders/sınıf bazlı ünite listesi; eksik dersler için GPT genel bilgiden üretir.
 */
export const CURRICULUM_UNITES: Record<string, Record<number, string[]>> = {
  cografya: {
    9: [
      '1. Ünite: Coğrafyanın Doğası ve Tarihsel Gelişimi',
      '2. Ünite: Mekânsal Bilgi Teknolojileri',
      '3. Ünite: Haritalar',
      '4. Ünite: Yerşekilleri',
      '5. Ünite: İklim',
      '6. Ünite: Doğal Sistemler',
      '7. Ünite: Beşeri Sistemler',
      '8. Ünite: Çevre ve Toplum',
    ],
    10: [
      '1. Ünite: Coğrafyanın Doğası',
      '2. Ünite: Mekânsal Bilgi Teknolojileri',
      '3. Ünite: Doğal Sistemler ve Süreçler',
      '4. Ünite: Beşerî Sistemler ve Süreçler',
      '5. Ünite: Ekonomik Faaliyetler ve Etkileri',
      '6. Ünite: Afetler ve Sürdürülebilir Çevre',
      '7. Ünite: Bölgeler, Ülkeler ve Küresel Bağlantılar',
    ],
  },
  matematik: {
    9: [
      '1. Ünite: Mantık',
      '2. Ünite: Kümeler',
      '3. Ünite: Denklemler ve Eşitsizlikler',
      '4. Ünite: Üçgenler',
      '5. Ünite: Vektörler',
      '6. Ünite: Olasılık',
      '7. Ünite: Veri Analizi',
    ],
    10: [
      '1. Ünite: Sayma ve Olasılık',
      '2. Ünite: Fonksiyonlar',
      '3. Ünite: Polinomlar',
      '4. Ünite: İkinci Dereceden Denklemler',
      '5. Ünite: Dörtgenler ve Çokgenler',
    ],
  },
  fizik: {
    9: [
      '1. Ünite: Fizik Bilimine Giriş',
      '2. Ünite: Madde ve Özellikleri',
      '3. Ünite: Hareket ve Kuvvet',
      '4. Ünite: Enerji',
    ],
  },
  kimya: {
    9: [
      '1. Ünite: Kimya Bilimi',
      '2. Ünite: Atom ve Periyodik Sistem',
      '3. Ünite: Kimyasal Türler Arası Etkileşimler',
    ],
  },
  biyoloji: {
    9: [
      '1. Ünite: Yaşam Bilimi Biyoloji',
      '2. Ünite: Hücre',
      '3. Ünite: Canlılar Dünyası',
    ],
  },
  tarih: {
    9: [
      '1. Ünite: Tarih ve Zaman',
      '2. Ünite: İnsanlığın İlk Dönemleri',
      '3. Ünite: Orta Çağda Dünya',
      '4. Ünite: İlk ve Orta Çağlarda Türkler',
    ],
  },
  turk_dili_edebiyati: {
    9: [
      '1. Ünite: İletişim',
      '2. Ünite: Hikâye',
      '3. Ünite: Şiir',
      '4. Ünite: Masal/Fabl',
      '5. Ünite: Roman',
      '6. Ünite: Tiyatro',
    ],
  },
  fen_bilimleri: {
    5: [
      '1. Ünite: Güneş, Dünya ve Ay',
      '2. Ünite: Canlılar Dünyası',
      '3. Ünite: Kuvvetin Ölçülmesi',
      '4. Ünite: Madde ve Değişim',
      '5. Ünite: Işığın Yayılması',
    ],
  },
};

/** Kazanım kod prefix – ders kısaltması (COĞ, MAT, FİZ, KİM, BİY, TAR, TDE) */
export const KAZANIM_PREFIX: Record<string, string> = {
  cografya: 'COĞ',
  matematik: 'MAT',
  fizik: 'FİZ',
  kimya: 'KİM',
  biyoloji: 'BİY',
  tarih: 'TAR',
  turk_dili_edebiyati: 'TDE',
  fen_bilimleri: 'FEN',
  turkce: 'TÜR',
  ingilizce: 'İNG',
  sosyal_bilgiler: 'SOS',
  din_kulturu: 'DK',
};
