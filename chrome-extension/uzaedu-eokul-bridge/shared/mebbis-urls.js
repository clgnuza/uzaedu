/** MEBBİS Ek Ders puantaj raporu (ekd04002). */
var UZA_MEBBIS_PUANTAJ_URL = 'https://mebbis.meb.gov.tr/EKD/ekd04002.aspx';
var UZA_MEBBIS_RAPOR_POSTBACK_TARGET = 'btnRaporGoruntule';

function uzaMebbisPuantajPage(href) {
  return /\/EKD\/ekd04002\.aspx/i.test(String(href || ''));
}

function uzaMebbisEkdPath(href) {
  return /\/EKD\//i.test(String(href || ''));
}
