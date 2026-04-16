/** WhatsApp / uygulama önizlemesi için örnek dolgu (gerçek gönderimde {AD} vb. değişkenler dolar). */
export const WA_SAMPLE_VELI = 'Adı SOYADI';
export const WA_SAMPLE_OGRENCI = 'Öğr. Adı SOYADI';
export const WA_SAMPLE_SINIF = '10 / A Şubesi';
export const WA_SAMPLE_OKUL = 'Okul Adı';

export function applyWaTemplateSamples(template: string): string {
  return template
    .replace(/{AD}/g, WA_SAMPLE_VELI)
    .replace(/{OGRENCI}/g, WA_SAMPLE_OGRENCI)
    .replace(/{SINIF}/g, WA_SAMPLE_SINIF)
    .replace(/{TARIH}/g, new Date().toLocaleDateString('tr-TR'))
    .replace(/{GUN}/g, '1 gün (tam gün)')
    .replace(/{TUR}/g, 'Özürsüz')
    .replace(/{CIKIS}/g, '31.10.2025')
    .replace(/{DONUS}/g, '03.11.2025')
    .replace(/{DERSLER_INLINE}/g, '1., 2., 3. ders')
    .replace(/{DERSLER}/g, '• Matematik (1. saat)\n• Fizik (2. saat)')
    .replace(/{OKUL}/g, WA_SAMPLE_OKUL)
    .replace(/{AY}/g, 'Ocak')
    .replace(/{BRUT}/g, '95.000,00')
    .replace(/{NET}/g, '72.500,00')
    .replace(/{SAAT}/g, '18')
    .replace(/{TUTAR}/g, '12.340,50');
}
