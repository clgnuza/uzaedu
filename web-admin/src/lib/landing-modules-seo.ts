import { LANDING_HUB_ITEMS, type LandingHubItem } from '@/components/landing/landing-hub-items';

const APP = 'Uzaedu Öğretmen';

export type LandingModuleSeo = LandingHubItem;

export const LANDING_MODULES_SEO = LANDING_HUB_ITEMS;

const BY_SLUG = new Map(LANDING_MODULES_SEO.map((m) => [m.slug, m]));

/** Google indeksi için herkese açık modül URL’si */
export function modulePublicPath(module: Pick<LandingModuleSeo, 'slug' | 'href'>): string {
  if (module.href.startsWith('/okul-degerlendirmeleri')) return '/okul-degerlendirmeleri';
  return `/moduller/${module.slug}`;
}

export function getLandingModuleBySlug(slug: string): LandingModuleSeo | undefined {
  return BY_SLUG.get(slug);
}

export function modulePageTitle(label: string): string {
  return `${label} | ${APP}`;
}

export function moduleMetaDescription(m: LandingModuleSeo): string {
  return `${m.description} ${m.detail}`.slice(0, 158);
}

export function moduleKeywords(m: LandingModuleSeo): string[] {
  return [m.label, APP, 'okul yönetimi', ...m.tags, 'MEB', 'öğretmen yazılımı'];
}

export function landingModulesJsonLd(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${base}/#moduller`,
        name: 'Uzaedu Öğretmen okul modülleri',
        description: 'Nöbet, kelebek sınav, mesaj merkezi, ek ders ve diğer okul yönetim modülleri.',
        numberOfItems: LANDING_MODULES_SEO.length,
        itemListElement: LANDING_MODULES_SEO.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: m.label,
          description: m.description,
          url: `${base}${modulePublicPath(m)}`,
        })),
      },
      ...LANDING_MODULES_SEO.map((m) => ({
        '@type': 'WebPage',
        '@id': `${base}${modulePublicPath(m)}#webpage`,
        url: `${base}${modulePublicPath(m)}`,
        name: modulePageTitle(m.label),
        description: moduleMetaDescription(m),
        isPartOf: { '@id': `${base}/#website` },
        inLanguage: 'tr',
      })),
    ],
  };
}
