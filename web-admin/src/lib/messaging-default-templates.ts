/** Varsayılan WhatsApp metin şablonları (satır sonları ve boşluklar mobil / wa.me için düzenlendi). */

export const TPL_EK_DERS = `💼 Ek ders özeti

Sayın {AD}

• Dönem : {AY}
• Süre  : {SAAT} saat
• Tutar : {TUTAR} TL

İyi çalışmalar.

────────
OgretmenPro`;

export const TPL_MAAS = `💼 Maaş özeti

Sayın {AD}

• Dönem : {AY}
• Brüt  : {BRUT} TL
• Net   : {NET} TL

İyi çalışmalar.

────────
OgretmenPro`;

export const TPL_DEVAMSIZLIK = `📋 Devamsızlık bildirimi

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}
• Tarih   : {TARIH}
• Gün     : {GUN}
• Tür     : {TUR}

Açıklama:
Öğrencimiz yukarıda belirtilen şekilde devamsızlık yapmıştır.

────────
📚 {OKUL}`;

export const TPL_DEVAMSIZLIK_MEKTUP = `📋 Devamsızlık mektubu

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}

Belgeniz ekte gönderilmiştir; incelemenizi rica ederiz.

────────
📚 {OKUL}`;

export const TPL_KARNE = `📋 Karne

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}

Karneniz ekte gönderilmiştir. İyi tatiller dileriz.

────────
📚 {OKUL}`;

export const TPL_ARA_KARNE = `📋 Ara karne

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}

Ara karne belgeniz ekte; ders notları ve devamsızlık bilgilerini içerir.

────────
📚 {OKUL}`;

export const TPL_DERS_DEVAMSIZLIK = `📋 Ders bazlı devamsızlık

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}
• Tarih   : {TARIH}

Açıklama:
Öğrencimiz belirtilen tarihte {DERSLER_INLINE} ders saatlerinde devamsızlık yapmıştır.

────────
📚 {OKUL}`;

export const TPL_IZIN = `📋 İzin bilgisi

Sayın {AD}

• Öğrenci : {OGRENCI}
• Sınıf   : {SINIF}

• İzin türü        : {TUR}
• İzinli çıkış     : {CIKIS}
• Pansiyona dönüş  : {DONUS}

Evci / çarşı izin bilgileri tarafınıza iletilmiştir.

────────
📚 {OKUL}`;

export const TPL_VELI_ILETISIM = `📨 Bilgilendirme

Sayın {AD}

Mesajınız okul yönetimi tarafından iletilmiştir.

────────
OgretmenPro`;

export const TPL_VELI_TOPLANTISI = `📋 Veli toplantısı

Sayın {AD}

Veli toplantımız aşağıdaki bilgilerle gerçekleştirilecektir:

• Tarih :
• Saat  :
• Yer   :

Katılımınızı bekleriz.

────────
OgretmenPro`;

export const DAVETIYE_PRESETS: { label: string; msg: string }[] = [
  {
    label: '🎓 Mezuniyet',
    msg: `📋 Davetiye — Mezuniyet

Sayın {AD}

Mezuniyet törenimize sizi davet etmekten onur duyarız.

• Tarih :
• Saat  :
• Yer   :

────────
OgretmenPro`,
  },
  {
    label: '🎭 Kermes / Etkinlik',
    msg: `📋 Davetiye — Etkinlik

Sayın {AD}

Okulumuzun düzenlediği etkinliğe davetlisiniz.

• Tarih :
• Saat  :
• Yer   :

────────
OgretmenPro`,
  },
  {
    label: '📚 Seminer',
    msg: `📋 Davetiye — Seminer

Sayın {AD}

Seminerimize katılımınızı bekliyoruz.

• Tarih :
• Saat  :
• Yer   :

────────
OgretmenPro`,
  },
  { label: '✏️ Özel', msg: '' },
];
