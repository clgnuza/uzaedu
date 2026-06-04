import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ModulePublicPage } from '@/components/landing/module-public-page';

export const revalidate = 3600;
import {
  getLandingModuleBySlug,
  LANDING_MODULES_SEO,
  moduleKeywords,
  moduleMetaDescription,
  modulePageTitle,
  modulePublicPath,
} from '@/lib/landing-modules-seo';
import { normalizePublicSiteUrl } from '@/lib/site-url';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LANDING_MODULES_SEO.filter((m) => !m.href.startsWith('/okul-degerlendirmeleri')).map((m) => ({
    slug: m.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const mod = getLandingModuleBySlug(slug);
  if (!mod) return { title: 'Modül | Uzaedu Öğretmen' };

  const path = modulePublicPath(mod);
  return {
    title: modulePageTitle(mod.label),
    description: moduleMetaDescription(mod),
    keywords: moduleKeywords(mod),
    alternates: { canonical: path },
    openGraph: {
      title: modulePageTitle(mod.label),
      description: moduleMetaDescription(mod),
      locale: 'tr_TR',
      url: path,
    },
  };
}

export default async function ModulSlugPage({ params }: Props) {
  const { slug } = await params;
  const mod = getLandingModuleBySlug(slug);
  if (!mod || mod.href.startsWith('/okul-degerlendirmeleri')) notFound();

  const base = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const path = modulePublicPath(mod);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: mod.label,
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            description: moduleMetaDescription(mod),
            url: `${base.replace(/\/$/, '')}${path}`,
            provider: { '@type': 'Organization', name: 'Uzaedu Öğretmen' },
          }),
        }}
      />
      <ModulePublicPage module={mod} />
    </>
  );
}
