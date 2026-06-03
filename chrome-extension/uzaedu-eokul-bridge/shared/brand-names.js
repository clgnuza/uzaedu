/**
 * Kullanıcıya görünen özgün sistem adları (telif/marka riski taşıyan resmî adlar yerine).
 * Teknik URL, API anahtarı ve kod tanımlayıcıları değiştirilmez.
 */
var UZA_BRAND = {
  product: 'Uzaedu Okul Köprüsü',
  productShort: 'Okul Köprüsü',
  /** E-Okul yerine */
  okulNet: 'OkulNet',
  /** MEBBİS yerine */
  personelNet: 'PersonelNet',
  /** KBS yerine */
  maliNet: 'MaliNet',
  /** e-yoklama yerine */
  sinifYoklama: 'Sınıf Yoklama',
  platformLabel: { eokul: 'OkulNet', mebbis: 'PersonelNet', kbs: 'MaliNet' },
  platformIcon: { eokul: 'ON', mebbis: 'PN', kbs: 'MN' },
  dirPull: 'Panele al',
  dirPush: "OkulNet'e yaz",
  dirBoth: 'Çift yön',
};

var UZA_ERR = {
  okulNetTabRequired: function () {
    return UZA_BRAND.okulNet + ' sekmesi gerekli.';
  },
  okulNetTabNotFound: function () {
    return (
      UZA_BRAND.okulNet +
      ' sekmesi bulunamadı. Resmî okul bilgi sistemi adresinde oturum açın.'
    );
  },
  okulNetSessionRequired: function () {
    return UZA_BRAND.okulNet + ' oturumu gerekli.';
  },
  okulNetSessionEnded: function () {
    return UZA_BRAND.okulNet + ' oturumu sona erdi.';
  },
  personelMaliTabRequired: function () {
    return UZA_BRAND.personelNet + ' veya ' + UZA_BRAND.maliNet + ' sekmesi yok.';
  },
  personelMaliExcelHint: function () {
    return (
      'Son Excel yok. ' +
      UZA_BRAND.personelNet +
      '/' +
      UZA_BRAND.maliNet +
      ' ekranında «Excele Aktar» kullanın veya dosya seçin.'
    );
  },
};
