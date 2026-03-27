'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { FileText, CalendarClock, BookOpen, Settings, Layers, ExternalLink } from 'lucide-react';
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
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-linear-to-br from-primary/[0.07] via-background to-muted/30 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/6 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
              <Layers className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Evrak & Plan Altyapısı
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                MEB çalışma takvimi, yıllık plan içerikleri ve Word/Excel evrak şablonları (MEB ve okul
                modeli). Öğretmenler bu şablonlarla{' '}
                <span className="font-medium text-foreground/90">/evrak</span> üzerinden üretim yapar.
              </p>
              {isSuperadmin && (
                <p className="text-xs text-muted-foreground">
                  BİLSEM yetenek alanı şablonları ve iş planı{' '}
                  <span className="font-medium text-foreground">ayrı sayfada</span> yönetilir — karışmaması için.
                </p>
              )}
            </div>
          </div>
          {isSuperadmin && (
            <Link
              href="/bilsem-sablon"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-violet-500/25 bg-violet-500/8 px-4 py-2.5 text-sm font-medium text-violet-800 shadow-sm transition hover:border-violet-500/40 hover:bg-violet-500/12 dark:text-violet-200"
            >
              <span>BİLSEM altyapısı</span>
              <ExternalLink className="size-4 opacity-80" aria-hidden />
            </Link>
          )}
        </div>
      </header>

      <div className="mobile-tab-scroll border-b border-border pb-1">
        <nav
          className="flex min-w-max gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 shadow-sm backdrop-blur-sm"
          aria-label="Evrak sekmeleri"
        >
          {TABS.filter((t) => !(t as { superadminOnly?: boolean }).superadminOnly || isSuperadmin).map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link
                key={t.id}
                href={`/document-templates?tab=${t.id}`}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary/35 bg-background text-primary shadow-md ring-1 ring-primary/15'
                    : 'border-transparent text-muted-foreground hover:bg-background/90 hover:text-foreground'
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
