import type { Metadata } from 'next';
import { fetchLegalPagesPublic } from '@/lib/legal-pages-public';
import { LegalPageLoadError, LegalPublicPageView } from '@/components/legal-pages/legal-public-page-view';

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchLegalPagesPublic();
  const block = data?.cookies;
  return {
    title: block ? `${block.title} | Öğretmen Pro` : 'Çerez Politikası | Öğretmen Pro',
    description: block?.meta_description ?? 'Öğretmen Pro çerez kullanımı ve tercihleri',
  };
}

export default async function CerezPage() {
  const data = await fetchLegalPagesPublic();
  const block = data?.cookies;
  if (!block) return <LegalPageLoadError />;
  return (
    <LegalPublicPageView
      block={block}
      links={[
        { href: '/gizlilik', label: 'Gizlilik Politikası' },
        { href: '/kullanim-sartlari', label: 'Kullanım Şartları' },
      ]}
    />
  );
}
