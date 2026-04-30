'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CalendarClock, BookOpen, Settings, FileText, ClipboardList, Gavel } from 'lucide-react';
import { SablonlarTab } from '../document-templates/sablonlar-tab';
import { AyarlarTab } from '../document-templates/ayarlar-tab';

const WorkCalendarEmbedded = dynamic(
  () =>
    import('../work-calendar/page').then((m) => {
      const Page = m.default;
      return { default: function CalEmbed() { return <Page embedded />; } };
    }),
  { ssr: false },
);

const BilsemTakvimEmbedded = dynamic(
  () =>
    import('./takvim/page').then((m) => {
      const Page = m.default;
      return { default: function BilEmbed() { return <Page embedded />; } };
    }),
  { ssr: false },
);

const YillikPlanBilsemTab = dynamic(
  () =>
    import('../yillik-plan-icerik/page').then((m) => {
      const Page = m.default;
      return { default: function Ypb() { return <Page curriculumModel="bilsem" />; } };
    }),
  { ssr: false },
);

const PlanKatkiModerasyonTab = dynamic(
  () =>
    import('@/components/bilsem/plan-katki-moderasyon-panel').then((m) => {
      return { default: function M() { return <m.PlanKatkiModerasyonPanel embedded />; } };
    }),
  { ssr: false },
);

const TABS = [
  { id: 'calisma-takvimi', label: 'Çalışma Takvimi', icon: CalendarClock },
  { id: 'is-plani', label: 'Bilsem İş Planı', icon: BookOpen },
  { id: 'yillik-plan', label: 'Yıllık Plan İçerikleri', icon: ClipboardList },
  { id: 'plan-katki-moderasyon', label: 'Plan katkı moderasyonu', icon: Gavel },
  { id: 'sablonlar', label: 'Şablonlar', icon: FileText },
  { id: 'ayarlar', label: 'Ayarlar', icon: Settings },
] as const;

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

const DEFAULT_TAB: (typeof TABS)[number]['id'] = 'is-plani';

/** Eski ?tab=yillik-plan-icerik (iş planı) */
const LEGACY_TAB_ALIASES: Record<string, (typeof TABS)[number]['id']> = {
  'yillik-plan-icerik': 'is-plani',
};

export default function BilsemSablonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, loading: authLoading } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';

  const rawParam = searchParams.get('tab') || DEFAULT_TAB;
  const rawTab = LEGACY_TAB_ALIASES[rawParam] ?? rawParam;
  const tab: (typeof TABS)[number]['id'] = TAB_IDS.has(rawTab) ? (rawTab as (typeof TABS)[number]['id']) : DEFAULT_TAB;

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperadmin) {
      router.replace('/403');
      return;
    }
    if (LEGACY_TAB_ALIASES[rawParam]) {
      router.replace(`/bilsem-sablon?tab=${LEGACY_TAB_ALIASES[rawParam]}`, { scroll: false });
      return;
    }
    if (!TAB_IDS.has(rawParam)) {
      router.replace(`/bilsem-sablon?tab=${DEFAULT_TAB}`, { scroll: false });
    }
  }, [authLoading, isSuperadmin, rawParam, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }
  if (!isSuperadmin) return null;

  const tabLinkClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
      active
        ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300'
        : 'border-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Bilsem altyapısı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          MEB çalışma takvimi, Bilsem iş planı (haftalık),{' '}
          <span className="font-medium text-foreground">Yıllık Plan İçerikleri</span> sekmesinde{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">curriculum_model = bilsem</code> ders satırları
          (ör. Coğrafya PÜY 2025-2026: <code className="rounded bg-muted px-1 text-xs">seed-yillik-plan-bilsem-cografya-2025-2026.sql</code>
          ). Word şablonları ve ders ayarları bu sayfada. Okul yöneticisi gruplar/dersler için kendi ekranını kullanır. Takvim:{' '}
          <Link href="/bilsem/takvim" className="font-medium text-primary underline">
            Bilsem takvim
          </Link>
          .
        </p>
      </div>

      <div className="mobile-tab-scroll border-b border-border pb-1">
        <nav className="flex min-w-max gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 shadow-sm" aria-label="Bilsem sekmeleri">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link key={t.id} href={`/bilsem-sablon?tab=${t.id}`} className={tabLinkClass(isActive)}>
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === 'calisma-takvimi' && <WorkCalendarEmbedded />}
      {tab === 'is-plani' && <BilsemTakvimEmbedded />}
      {tab === 'yillik-plan' && <YillikPlanBilsemTab />}
      {tab === 'plan-katki-moderasyon' && <PlanKatkiModerasyonTab />}
      {tab === 'sablonlar' && <SablonlarTab fixedCurriculumModel="bilsem" />}
      {tab === 'ayarlar' && <AyarlarTab variant="bilsem" />}
    </div>
  );
}
