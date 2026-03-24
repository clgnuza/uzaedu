import type { Metadata } from 'next';
import { fetchLegalPagesPublic } from '@/lib/legal-pages-public';
import { LegalPageLoadError, LegalPublicPageView } from '@/components/legal-pages/legal-public-page-view';

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchLegalPagesPublic();
  const block = data?.privacy;
  return {
    title: block ? `${block.title} | Öğretmen Pro` : 'Gizlilik Politikası | Öğretmen Pro',
    description: block?.meta_description ?? 'Öğretmen Pro gizlilik politikası ve KVKK aydınlatma metni',
  };
}

export default async function GizlilikPage() {
  const data = await fetchLegalPagesPublic();
  const block = data?.privacy;
  if (!block) return <LegalPageLoadError />;
  return (
    <LegalPublicPageView
      block={block}
      links={[
        { href: '/kullanim-sartlari', label: 'Kullanım Şartları' },
        { href: '/cerez', label: 'Çerez Politikası' },
      ]}
    />
  );
}
