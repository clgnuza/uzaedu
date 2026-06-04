import type { Metadata } from 'next';
import { LANDING_MODULES_SEO } from '@/lib/landing-modules-seo';

export const revalidate = 3600;
import {
  moduleAccentForSlug,
  ModulesPublicGridCard,
} from '@/components/landing/modules-public-card';
import { ModulesPublicHero, ModulesPublicShell } from '@/components/landing/modules-public-shell';

export const metadata: Metadata = {
  title: 'Okul Yönetim Modülleri | Uzaedu Öğretmen',
  description:
    'Nöbet, kelebek sınav, mesaj merkezi, ek ders, optik okuma, öğretmen ajandası ve 15 okul modülü. Uzaedu Öğretmen dijital platform.',
  keywords: [
    'okul modülleri',
    'kelebek sınav',
    'nöbet programı',
    'mesaj merkezi',
    'ek ders',
    'Uzaedu Öğretmen',
  ],
  alternates: { canonical: '/moduller' },
  openGraph: {
    title: 'Okul Yönetim Modülleri | Uzaedu Öğretmen',
    description: 'Uzaedu Öğretmen okul yönetim modülleri ve özellikleri.',
    locale: 'tr_TR',
  },
};

export default function ModullerIndexPage() {
  return (
    <ModulesPublicShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <ModulesPublicHero
          eyebrow="Uzaedu Öğretmen"
          title="Okul yönetim modülleri"
          description="Nöbet, sınav, mesaj, ek ders ve tüm okul süreçleri — her modülün özellikleri ve kısa tanıtımı."
          moduleCount={LANDING_MODULES_SEO.length}
        />

        <ul className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:gap-4">
          {LANDING_MODULES_SEO.map((m) => (
            <ModulesPublicGridCard key={m.slug} module={m} accent={moduleAccentForSlug(m.slug)} />
          ))}
        </ul>
      </main>
    </ModulesPublicShell>
  );
}
