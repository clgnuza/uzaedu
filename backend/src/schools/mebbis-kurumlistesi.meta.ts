/**
 * https://mebbis.meb.gov.tr/kurumlistesi.aspx — form ilk yanıtında gömülü DevExpress itemsInfo.
 * "Kurum Türü" (cmbAnaTur) aynı HTML'de boş gelir; il/ilçe/özel-resmi sonrası sunucu doldurur.
 * Aktarım: postback sonrası HTML veya "Excel'e Aktar" çıktısından tür metinleri/kodları çıkarılmalı.
 */
export const MEBBIS_KURUMLISTESI_KURUM_OWNER_OPTIONS = [
  { value: '-1', text: 'Seçiniz!' },
  { value: '1', text: 'Resmi Kurumlar' },
  { value: '2', text: 'Özel Kurumlar' },
  { value: '3', text: 'MEB Dışı Kurumlar' },
] as const;
