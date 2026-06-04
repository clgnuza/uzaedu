/** Chrome Web Store — yayın sonrası .env ile güncellenir. */
export function okulKoprusuChromeStoreUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_OKUL_KOPRUSU_CHROME_STORE_URL?.trim();
  return url && url.startsWith('https://') ? url : null;
}

export const OKUL_KOPRUSU_MARKET_HREF = '/market?module=okul_koprusu';
