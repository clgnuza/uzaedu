/**
 * Canlıda yanlışlıkla `NEXT_PUBLIC_SITE_URL=https://uzaedu.com:3000` gibi değerler
 * metadataBase / OpenGraph / iframe çözümlemesinde kullanılamayan URL üretir (Nginx :3000 dışarı açık değil).
 */
export function normalizePublicSiteUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:3000';
  const s = raw?.trim() || fallback;
  try {
    const u = new URL(s);
    const isUza =
      u.hostname === 'uzaedu.com' ||
      u.hostname === 'www.uzaedu.com' ||
      u.hostname.endsWith('.uzaedu.com');
    if (isUza && (u.port === '3000' || u.port === '4000')) {
      u.port = '';
    }
    return u.origin;
  } catch {
    return fallback;
  }
}

/** SEO `site_url` vb. tam adreslerde uzaedu.* için :3000 / :4000 kaldırılır. */
export function stripUzaBadPortsFromUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const isUza =
      u.hostname === 'uzaedu.com' ||
      u.hostname === 'www.uzaedu.com' ||
      u.hostname.endsWith('.uzaedu.com');
    if (isUza && (u.port === '3000' || u.port === '4000')) {
      u.port = '';
    }
    return u.href;
  } catch {
    return raw;
  }
}
