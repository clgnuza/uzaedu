/**
 * Kullanıcıya görünen sistem adları (MEB / resmî kısaltmalar).
 * Teknik URL, API anahtarı ve kod tanımlayıcıları değiştirilmez.
 */
var UZA_BRAND = {
  product: 'Uzaedu Okul Köprüsü',
  productShort: 'Okul Köprüsü',
  okulNet: 'e-Okul',
  personelNet: 'MEBBİS',
  maliNet: 'KBS',
  sinifYoklama: 'e-yoklama',
  platformLabel: { eokul: 'e-Okul', mebbis: 'MEBBİS', kbs: 'KBS' },
  platformIcon: { eokul: 'eO', mebbis: 'M', kbs: 'K' },
  dirPull: 'Panele al',
  dirPush: "e-Okul'a yaz",
  dirBoth: 'Çift yön',
};

var UZA_ERR = {
  okulNetTabRequired: function () {
    return UZA_BRAND.okulNet + ' sekmesi gerekli.';
  },
  okulNetTabNotFound: function () {
    return (
      UZA_BRAND.okulNet +
      ' sekmesi gerekli. e-okul.meb.gov.tr adresinde oturum açın (MEBBİS/KBS işlemleri için zorunlu değil).'
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
