/**
 * Okul city değerini content_items.city_filter ile eşleştirmek için normalize.
 * MEB il subdomain'leri (ankara, kmaras, sanliurfa vb.) ile eşleşir.
 */
const DISPLAY_TO_SUBDOMAIN: Record<string, string> = {
  afyonkarahisar: 'afyon',
  afyon: 'afyon',
  kahramanmaras: 'kmaras',
  maras: 'kmaras',
  kmaras: 'kmaras',
  sanliurfa: 'sanliurfa',
  urfa: 'sanliurfa',
  icel: 'mersin',
  mersin: 'mersin',
};

function toAscii(str: string): string {
  return str
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/I/g, 'i');
}

export function normalizeCityForMebFilter(city: string | null | undefined): string | null {
  if (!city || typeof city !== 'string') return null;
  const s = city.trim();
  if (!s) return null;
  const lower = s.toLocaleLowerCase('tr-TR');
  const ascii = toAscii(lower);
  return DISPLAY_TO_SUBDOMAIN[ascii] ?? ascii;
}
