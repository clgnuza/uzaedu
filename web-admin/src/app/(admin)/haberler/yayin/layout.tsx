import type { Metadata } from 'next';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { normalizePublicSiteUrl, stripUzaBadPortsFromUrl } from '@/lib/site-url';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
const YAYIN_PATH = '/haberler/yayin';

async function getSeoConfig() {
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
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoConfig();
  if (!seo) return { title: 'Haber Yayını – Öğretmen Pro' };
    const title = seo?.title || 'Haber Yayını – Öğretmen Pro';
    const description = seo?.description || '';
    const ogImage = seo?.og_image || null;
    const siteName = seo?.site_name || 'Öğretmen Pro';
    const siteUrl = (
      seo?.site_url?.trim() ? stripUzaBadPortsFromUrl(seo.site_url) : SITE_URL
    ).replace(/\/$/, '');
    const canonicalUrl = `${siteUrl}${YAYIN_PATH}`;

    return {
      title,
      description: description || undefined,
      robots: { index: seo?.robots === 'index', follow: seo?.robots === 'index' },
      keywords: seo?.keywords ? seo.keywords.split(/[,\s]+/).filter(Boolean) : undefined,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: 'website',
        url: canonicalUrl,
        title,
        description: description || undefined,
        siteName,
        locale: 'tr_TR',
        ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: description || undefined,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
}

/**
 * Haber Yayın: Haberler sayfası ile aynı container yapısında (standard admin layout).
 * WebPage JSON-LD Schema.org structured data for search engines.
 */
export default async function YayinLayout({ children }: { children: React.ReactNode }) {
  const seo = await getSeoConfig();
  const title = seo?.title || 'Haber Yayını – Öğretmen Pro';
  const description = seo?.description || '';
  const siteUrl = (seo?.site_url?.trim() ? stripUzaBadPortsFromUrl(seo.site_url) : SITE_URL).replace(
    /\/$/,
    '',
  );
  const canonicalUrl = `${siteUrl}${YAYIN_PATH}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description || undefined,
    url: canonicalUrl,
    inLanguage: 'tr',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
