import type { MetadataRoute } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { normalizePublicSiteUrl } from '@/lib/site-url';

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = SITE_URL.replace(/\/$/, '');
  const extras = await fetchWebExtrasPublic();
  if (extras?.global_robots_noindex) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/403'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
