'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { getMarketModuleKeyForPath } from '@/config/module-market-route';
import { SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';
import { ModuleEntryFeeBanner } from '@/components/market/module-entry-fee-banner';
import { MODULE_ACTIVATION_REFRESH_EVENT } from '@/lib/module-activation-events';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';

type ActivationStatusRes = {
  billing_account: 'user' | 'school';
  modules: Record<string, { free: boolean; active: boolean }>;
};

function ActivationWall({ moduleKey }: { moduleKey: SchoolModuleKey }) {
  const label = SCHOOL_MODULE_LABELS[moduleKey];
  const href = `/market?module=${encodeURIComponent(moduleKey)}`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-linear-to-br from-amber-500/12 via-card to-violet-500/10 p-6 shadow-xl ring-1 ring-amber-500/15 dark:from-amber-950/40 dark:to-violet-950/25 dark:ring-amber-500/20 sm:p-10"
      role="alert"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full bg-violet-500/15 blur-2xl" />

      <div className="relative mx-auto max-w-lg space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500/25 to-violet-500/20 text-amber-900 shadow-inner ring-1 ring-amber-500/30 dark:from-amber-400/20 dark:to-violet-500/15 dark:text-amber-100">
          <Lock className="size-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            <Sparkles className="size-3.5" aria-hidden />
            Modül kilitli
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{label}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Bu modülün tüm sayfalarını kullanmak için aylık veya yıllık tarifeye göre Market üzerinden bir kez
            etkinleştirmeniz gerekir. Jeton veya ek ders bakiyeniz yeterliyse aşağıdan Market’e gidip etkinleştirin.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="gap-2 bg-linear-to-r from-amber-600 to-violet-600 text-white shadow-md hover:from-amber-600/95 hover:to-violet-600/95"
          >
            <Link href={href}>
              Market — etkinleştir
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Aynı modülün tüm alt path’lerinde (sekme/route) tek kural: ücretli ve etkin değilse içerik gösterilmez.
 */
export function ModuleContentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { token, me } = useAuth();
  const moduleKey = getMarketModuleKeyForPath(pathname ?? '');
  const exempt = me?.role === 'superadmin' || me?.role === 'moderator';

  const [phase, setPhase] = useState<'idle' | 'loading' | 'ok' | 'blocked'>('idle');

  const load = useCallback(async () => {
    if (!token) {
      setPhase('ok');
      return;
    }
    if (exempt || !moduleKey) {
      setPhase('ok');
      return;
    }
    setPhase('loading');
    try {
      const data = await apiFetch<ActivationStatusRes>('/market/modules/activation-status', { token });
      const row = data.modules[moduleKey];
      if (!row || row.free || row.active) setPhase('ok');
      else setPhase('blocked');
    } catch {
      setPhase('ok');
    }
  }, [token, exempt, moduleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const on = () => void load();
    window.addEventListener(MODULE_ACTIVATION_REFRESH_EVENT, on);
    return () => window.removeEventListener(MODULE_ACTIVATION_REFRESH_EVENT, on);
  }, [load]);

  if (exempt || !moduleKey) {
    return (
      <>
        <ModuleEntryFeeBanner />
        {children}
      </>
    );
  }

  if (phase === 'loading' || phase === 'idle') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground">Modül erişimi kontrol ediliyor…</p>
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div className="space-y-6">
        <ActivationWall moduleKey={moduleKey} />
      </div>
    );
  }

  return (
    <>
      <ModuleEntryFeeBanner />
      {children}
    </>
  );
}
