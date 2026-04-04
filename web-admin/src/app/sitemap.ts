import type { MetadataRoute } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { normalizePublicSiteUrl } from '@/lib/site-url';

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [];

  let revalidate = 300;
  try {
    const ex = await fetchWebExtrasPublic();
    if (ex?.cache_ttl_yayin_seo != null && Number.isFinite(ex.cache_ttl_yayin_seo)) {
      revalidate = Math.max(10, Math.min(86400, Math.round(ex.cache_ttl_yayin_seo)));
    }
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/yayin-seo`, {
      next: { revalidate },
    });
    if (res.ok) {
      const seo = await res.json();
      if (seo?.robots === 'index') {
        const siteUrl = seo?.site_url?.replace(/\/$/, '') || base;
        entries.push({
          url: `${siteUrl}/haberler/yayin`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        });
      }
    }
  } catch {
    // Yayın sayfası index değilse veya API hatalıysa sitemap boş kalır
  }

  return entries;
}
