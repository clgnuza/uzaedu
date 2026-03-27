'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { FileText, CalendarClock, BookOpen, Settings } from 'lucide-react';
import { SablonlarTab } from './sablonlar-tab';
import { AyarlarTab } from './ayarlar-tab';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const WorkCalendarTab = dynamic(
  () => import('../work-calendar/page').then((m) => ({ default: m.default })),
  { ssr: false },
);

const YillikPlanIcerikTab = dynamic(
  () => import('../yillik-plan-icerik/page').then((m) => ({ default: m.default })),
  { ssr: false },
);

const TABS = [
  { id: 'calisma-takvimi', label: 'Çalışma Takvimi', icon: CalendarClock },
  { id: 'yillik-plan-icerik', label: 'Yıllık Plan İçerikleri', icon: BookOpen },
  { id: 'sablonlar', label: 'Şablonlar', icon: FileText },
  { id: 'ayarlar', label: 'Ayarlar', icon: Settings, superadminOnly: true },
] as const;

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

const DEFAULT_TAB = 'calisma-takvimi';

const LEGACY_BILSEM_TAB_MAP: Record<string, string> = {
  'bilsem-calisma-takvimi': 'calisma-takvimi',
  'bilsem-yillik-plan-icerik': 'is-plani',
  'bilsem-sablonlar': 'sablonlar',
  'bilsem-ayarlar': 'ayarlar',
};

export default function DocumentTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, loading: authLoading } = useAuth();
  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));
  const isSuperadmin = me?.role === 'superadmin';

  const rawTab = searchParams.get('tab') || DEFAULT_TAB;
  const legacyBilsemTarget = LEGACY_BILSEM_TAB_MAP[rawTab];
  const ayarlarTab = TABS.find((t) => t.id === 'ayarlar');
  const canSeeAyarlar =
    ayarlarTab && (ayarlarTab as { superadminOnly?: boolean }).superadminOnly
      ? isSuperadmin
      : true;

  const tab = (() => {
    if (legacyBilsemTarget) return DEFAULT_TAB;
    if (!TAB_IDS.has(rawTab)) return DEFAULT_TAB;
    if (rawTab === 'ayarlar' && !canSeeAyarlar) return DEFAULT_TAB;
    return rawTab;
  })();

  useEffect(() => {
    if (legacyBilsemTarget) {
      router.replace(`/bilsem-sablon?tab=${legacyBilsemTarget}`, { scroll: false });
      return;
    }
    if (rawTab === 'ayarlar' && !canSeeAyarlar) {
      router.replace(`/document-templates?tab=${DEFAULT_TAB}`, { scroll: false });
      return;
    }
    if (!TAB_IDS.has(rawTab)) {
      router.replace(`/document-templates?tab=${DEFAULT_TAB}`, { scroll: false });
    }
  }, [rawTab, canSeeAyarlar, legacyBilsemTarget, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!canManage) {
      router.replace('/403');
    }
  }, [authLoading, canManage, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }
  if (!canManage) return null;

  if (legacyBilsemTarget) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yönlendiriliyor…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mobile-tab-scroll border-b border-border pb-1">
        <nav className="flex min-w-max gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 shadow-sm" aria-label="Evrak sekmeleri">
          {TABS.filter((t) => !(t as { superadminOnly?: boolean }).superadminOnly || isSuperadmin).map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link
                key={t.id}
                href={`/document-templates?tab=${t.id}`}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === 'sablonlar' && <SablonlarTab excludeCurriculumModel="bilsem" />}
      {tab === 'calisma-takvimi' && <WorkCalendarTab />}
      {tab === 'yillik-plan-icerik' && <YillikPlanIcerikTab />}
      {tab === 'ayarlar' && <AyarlarTab />}
    </div>
  );
}
