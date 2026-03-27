/**
 * RSS sıkça il görseli için "tuncelimeb.gov.tr" yazar; çözümlenen host "tunceli.meb.gov.tr" olmalı.
 */
export function normalizeMebIlImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const s = url.trim();
  if (!s.startsWith('http')) return s;
  try {
    const u = new URL(s);
    const m = /^([a-z0-9-]+)meb\.gov\.tr$/i.exec(u.hostname);
    if (m) {
      u.hostname = `${m[1]}.meb.gov.tr`;
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return s;
}
