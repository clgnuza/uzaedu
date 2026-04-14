import type { MetadataRoute } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { normalizePublicSiteUrl } from '@/lib/site-url';

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, '');
  const now  = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: base,                              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/login`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/login/ogretmen`,          lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/login/okul`,              lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/register`,                lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/register/ogretmen`,       lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/register/okul`,           lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/sinav-gorev-ucretleri`,   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/ek-ders-hesaplama`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/hesaplamalar`,             lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/iletisim`,                lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/gizlilik`,                lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/kullanim-sartlari`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/cerez`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];

  // Yaın sayfası: dinamik öncelik
  let revalidate = 300;
  try {
    const ex = await fetchWebExtrasPublic();
    if (ex?.cache_ttl_yayin_seo != null && Number.isFinite(ex.cache_ttl_yayin_seo)) {
      revalidate = Math.max(10, Math.min(86400, Math.round(ex.cache_ttl_yayin_seo)));
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/yayin-seo`, {
      next: { revalidate },
    });
    if (res.ok) {
      const seo = await res.json();
      if (seo?.robots === 'index') {
        const siteUrl = seo?.site_url?.replace(/\/$/, '') || base;
        entries.push({
          url:             `${siteUrl}/haberler/yayin`,
          lastModified:    now,
          changeFrequency: 'daily' as const,
          priority:        0.9,
        });
      }
    }
  } catch { /* ignore */ }

  return entries;
}
