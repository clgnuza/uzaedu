import type { Metadata } from 'next';
import { fetchLegalPagesPublic } from '@/lib/legal-pages-public';
import { LegalPageLoadError, LegalPublicPageView } from '@/components/legal-pages/legal-public-page-view';

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchLegalPagesPublic();
  const block = data?.terms;
  return {
    title: block ? `${block.title} | ÖğretmenPro` : 'Kullanım Şartları | ÖğretmenPro',
    description: block?.meta_description ?? 'ÖğretmenPro kullanım şartları ve hizmet sözleşmesi. Platform kuralları ve koşulları.',
  };
}

export default async function KullanimSartlariPage() {
  const data = await fetchLegalPagesPublic();
  const block = data?.terms;
  if (!block) return <LegalPageLoadError />;
  return (
    <LegalPublicPageView
      block={block}
      links={[
        { href: '/gizlilik', label: 'Gizlilik Politikası' },
        { href: '/cerez', label: 'Çerez Politikası' },
      ]}
    />
  );
}
