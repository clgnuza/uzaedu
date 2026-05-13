/** yolluk2026 «Geçici Yolluk» + «Konaklama Açıklama» ile uyumlu sabitler */

/** YEVMİYE sütunu için yaygın açıklama (24 saat üçe bölünür). */
export const YEVMIYE_SAAT_ORNEGI_BASLIK = '24 saati 3 bölüyoruz · geçirdiğimiz süre';

export const YEVMIYE_SAAT_ORNEGI_SATIRLARI = [
  '1–8 saat arası → 1',
  '9–16 saat arası → 2',
  '17–24 saat arası → 3',
] as const;

/** Açılır listedeki kesirlerin gündeliğe yansıması */
export const YEVMIYE_KESIR_UYARISI =
  'Seçim, gündeliğe uygulanan H cetveli kesridir: 1 = tam, 1/2 = yarım, 2/3 ve 1/3. Üstteki saat aralığını gidiş–dönüş sürenizle birlikte değerlendirin; resmî şablonunuzla eşleştirin.';

export const YEVMIYE_KOD_OPTIONS: {
  kod: '1' | '2' | '3' | '4';
  pay: number;
  label: string;
  optionTitle: string;
}[] = [
  {
    kod: '1',
    pay: 1,
    label: '1 — tam',
    optionTitle: 'Tam gün (gündelik × 1). Kısa görevde 1–8 saat dilimi bazı tablolarda «1» ile gösterilir.',
  },
  {
    kod: '2',
    pay: 1 / 2,
    label: '1/2',
    optionTitle: 'Yarım gün (gündelik × 0,5). 9–16 saat dilimi bazı tablolarda «2» ile gösterilir.',
  },
  {
    kod: '3',
    pay: 2 / 3,
    label: '2/3',
    optionTitle: 'Gündeliğin iki üçte biri (× ≈ 0,67). 17–24 saat dilimi bazı tablolarda «3» ile gösterilir.',
  },
  {
    kod: '4',
    pay: 1 / 3,
    label: '1/3',
    optionTitle: 'Gündeliğin bir üçte biri (× ≈ 0,33). Çok kısa görevlerde kullanılabilir.',
  },
];

export const UNVAN_OPTIONS = [
  'Öğretmen',
  'Sözleşmeli öğretmen',
  'Uzman öğretici',
  'Öğretmen (branş)',
  'Müdür',
  'Müdür yardımcısı',
  'Şube müdürü',
  'Memur',
  'Diğer',
] as const;

export const BIRIM_YETKILI_UNVAN_OPTIONS = ['Müdür', 'Müdür yardımcısı', 'Şube müdürü', 'Okul müdürü', 'Diğer'] as const;

export const TASIT_CESIT_OPTIONS = ['OTO', 'OTOBÜS', 'TREN', 'UÇAK', 'SERVİS', 'DİĞER'] as const;

/** Sık görev yeri / birim (elle de girilebilir) */
export const DAIRE_GOREV_YERI_OPTIONS = [
  'Silvan',
  'Diyarbakır merkez',
  'Kayapınar',
  'Bağlar',
  'Sur',
  'Bismil',
  'Ergani',
  'Dicle',
  'Çınar',
  'Çermik',
  'Kulp',
  'Lice',
  'Hani',
  'Hazro',
  'Kocaköy',
  '— Elle yaz',
] as const;

/** Güzergâh uçları (nereden / nereye) */
export const YER_SECIM_OPTIONS = [
  'SİLVAN',
  'DİYARBAKIR',
  'KAYAPINAR',
  'BAĞLAR',
  'SUR',
  'BİSMİL',
  'ERGANİ',
  'DİCLE',
  'ÇINAR',
  'ÇERMİK',
  'KULP',
  'LİCE',
  'HANI',
  'HAZRO',
  'KOCAKÖY',
  '— Elle yaz',
] as const;

export const KONAKLAMA_BEYAN_OPTIONS = [
  { value: 'hayir', label: 'Hayır (özet konaklama yok / 0)' },
  { value: 'evet', label: 'Evet (belgeli; tavan m.33 + fatura)' },
] as const;

export const GECICI_YOLLUK_UYARILARI = [
  'Gündelik: ilgili yıl Merkezi Yönetim Bütçe Kanunu H cetveli (6245/33). Ek gösterge veya kadro derecesi seçimi H cetveli tutarına bağlanır.',
  'Geçici görev: 6245 m.14 (yol + yevmiye + kanunda sayılanlar); m.33 yevmiye oranları; aynı yer/iş için yılda en çok 180 gün (90+90 kademeli özet modunda).',
  'Konaklama (m.33/1-b): İlk 10 gün için en fazla gündeliğin %150’si; 11–80. günler arası %50’si; 81–90. günler arası %40’ı; ödeme belgeli fatura tutarını geçemez (Konaklama Açıklama sekmesi).',
  'Bu ekran bilgilendirme ve iç kayıt içindir; kesin ödeme kurum mali işler / mevzuatına tabidir.',
] as const;

/** Bildirim üst bilgisi — kullanıcıya kısa köprü metin */
export const GECICI_BILDIRIM_META_NOTU =
  'PDF’te «Bütçe yılı» = yukarıda seçilen mali yıl. «Görev yeri» ve «Konaklama beyanı» şablondaki bilgi alanlarıdır; gerçek ödenecek konaklama tutarı ayrıca aşağıdaki «Konaklama (özet TL)» ile girilir.';

/** İç gündelik (H cetveli) nasıl seçilir */
export const GECICI_IC_GUNDELIK_ONCELIK =
  'Tablodaki gündelik hesabı için kullanılan iç yevmiye tutarı önceliği: elle gündelik (TL) > ek gösterge bandı > kadro derecesi > yedek gündelik (süperadmin parametresi).';

/** Okul yolluk ekranı — teknik/kurumsal rol adı yok */
export const GECICI_IC_GUNDELIK_ONCELIK_OKUL =
  'Tabloda kullanılacak günlük tutar sırası: elle girdiğiniz gündelik (TL) > ek gösterge bandı > kadro derecesi > yedek gündelik (açılır listede size sunulan tutarlar).';

/** Tablo dışı özet kalemler — okul ekranı; Excel dışa aktarma yok */
export const GECICI_OZET_MASRAF_ACIKLAMA =
  'Tablo satırları: gündelik + satırdaki taşıt/zorunlu + «Dövizin cinsi (TL)». Aşağıdaki özet TL alanları (yol, konaklama, taşıt özeti, taksi/hamal, diğer) genel toplama eklenir; «Hesapla» sonrası «Sonuç» listesinde kalemler olarak görünür ve kayıtta saklanır. ' +
  'Bu ekrandan Excel (.xlsx) üretilmez. «Yolluk resmi rapor» PDF’i özet satırlarını içerir. Geçici bildirim PDF’inde tutar girilmiş özet kalemler, tablo ızgarasında GENEL TOPLAM satırından hemen önce ayrı satırlar olarak basılır; GENEL TOPLAM sağdaki toplam hücresi kayıttaki genel toplamı (özet dahil) gösterir.';

export const GECICI_SATIR_ALAN_IPUCU = {
  tarih: 'Görev veya oturma günü (PDF ilk sütun).',
  yer_from: 'Hareket / hizmet yeriniz (şablondaki nereden).',
  yer_to: 'Gidilen yer (şablondaki nereye).',
  saat: 'Gidiş ve dönüş saati (yevmiye kodu ile birlikte değerlendirilir).',
  gun: 'Aynı güzergâhta kalınan gün sayısı.',
  yevmiye:
    'Yevmiye: 24 saat üç dilime bölünür (1–8→1, 9–16→2, 17–24→3). Listede 1, 1/2, 2/3, 1/3 = H cetveli kesri. Üstteki uyarı kutusu ve seçenek üzerine gelince ayrıntı.',
  tasit_tip: 'Taşıt ve zorunlu giderler sütunundaki çeşit (OTO, OTOBÜS vb.).',
  tasit_tl: 'Taşıt ve zorunlu giderler tutarı (TL), satıra özel.',
  doviz_tl: 'Şablondaki ikinci TL sütunu: bilet / ek yol vb. (satıra özel, tabloda döviz cinsi TL).',
} as const;
