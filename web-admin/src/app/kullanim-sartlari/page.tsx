import type { Metadata } from 'next';
import { fetchLegalPagesPublic } from '@/lib/legal-pages-public';
import { LegalPageLoadError, LegalPublicPageView } from '@/components/legal-pages/legal-public-page-view';

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchLegalPagesPublic();
  const block = data?.terms;
  return {
    title: block ? `${block.title} | Öğretmen Pro` : 'Kullanım Şartları | Öğretmen Pro',
    description: block?.meta_description ?? 'Öğretmen Pro kullanım şartları ve hizmet sözleşmesi',
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
