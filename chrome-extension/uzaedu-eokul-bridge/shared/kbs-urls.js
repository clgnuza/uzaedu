/** KBS / KPHYS sekme eşleşmeleri (kbs.gov.tr + eski muhasebat hostları). */
var UZA_KBS_TAB_PATTERNS = [
  'https://kbs.muhasebat.gov.tr/*',
  'https://www.kbs.muhasebat.gov.tr/*',
  'https://kbs.gov.tr/*',
  'https://www.kbs.gov.tr/*',
  'https://giris.hmb.gov.tr/*',
];

var UZA_KBS_LOGIN_URL = 'https://www.kbs.gov.tr/gen/login.htm';
var UZA_KBS_MAAS_RAPOR_URL = 'https://www.kbs.gov.tr/maasRapor/maasRapor.htm';
var UZA_KBS_EK_DERS_RAPOR_URL = 'https://www.kbs.gov.tr/yeniakademik/p_yenirapor.htm';
/** @deprecated muhasebat hostu bazı ağlarda kapanmış; giriş kbs.gov.tr üzerinden. */
var UZA_KBS_MUHASEBAT_HOME = UZA_KBS_LOGIN_URL;

function uzaKbsOpenUrl(bordroType) {
  const q = globalThis.UZA_EXTENSION_UI?.chromeTabQueries;
  if (bordroType === 'maas_bordro') {
    return q?.kbsMaasRaporUrl || UZA_KBS_MAAS_RAPOR_URL;
  }
  if (bordroType === 'ek_ders_bordro') {
    return q?.kbsEkDersRaporUrl || q?.kbsEkDersEntryUrl || UZA_KBS_EK_DERS_RAPOR_URL;
  }
  return q?.kbsLoginUrl || UZA_KBS_LOGIN_URL;
}

function uzaKbsUrlLooksLikeMaas(href) {
  return /maasrapor|maas\.rapor|maas_rapor/i.test(String(href || ''));
}

function uzaKbsUrlLooksLikeEkDersRapor(href) {
  return /yeniakademik|p_yenirapor|yenirapor/i.test(String(href || ''));
}

function uzaKbsUrlLooksLikeEkDersBordro(href) {
  const h = String(href || '').toLowerCase();
  if (uzaKbsUrlLooksLikeMaas(h)) return false;
  if (uzaKbsUrlLooksLikeEkDersRapor(h)) return true;
  return /ekders|ek.ders|ek_ders|bordrohesap|bordro.hesap/i.test(h);
}

/** Maaş / ek ders rapor ekranları: tablo yok, Excel indirme. */
function uzaKbsIsDownloadOnlyPage(href) {
  return uzaKbsUrlLooksLikeMaas(href) || uzaKbsUrlLooksLikeEkDersRapor(href);
}

function uzaKbsScrapeHint(bordroType) {
  if (bordroType === 'maas_bordro') {
    return 'maasRapor.htm: dönem seçin → indirin → «Son indirilen Excel».';
  }
  if (bordroType === 'ek_ders_bordro') {
    return 'p_yenirapor.htm: rapor oluşturun → indirin → «Son indirilen Excel».';
  }
  return 'KBS personel listesi veya bordro tablosu görünür olmalı.';
}
