'use client';

import { DersDagitStudioNav } from '@/components/ders-dagit/studio-nav';
import { StudioOnboarding } from '@/components/ders-dagit/studio-onboarding';
import { StudioHubBar } from '@/components/ders-dagit/StudioHubBar';
import { StudioMobileNav } from '@/components/ders-dagit/studio-mobile-nav';
import { DersDagitStudioProvider } from '@/hooks/ders-dagit-studio-provider';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { DD_SETUP_STEPS } from '@/components/ders-dagit/dd-setup-checklist';
import { showStudioDataNav, showStudioOnboarding } from '@/lib/ders-dagit-studio-nav';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

function isSetupComplete(overview: NonNullable<ReturnType<typeof useDersDagitStudio>['overview']>) {
  const c = overview.counts;
  const errs = overview.validation.filter((v) => v.severity === 'error').length;
  const st = overview.studio?.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const periodOk = !!((st?.period?.work_days ?? st?.work_days)?.length);
  return (
    DD_SETUP_STEPS.every((s) => {
      if (s.kind === 'validation') return errs === 0;
      if (s.kind === 'period') return periodOk;
      return (c[s.key] ?? 0) >= s.min;
    }) && errs === 0
  );
}

export default function DersDagitStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <DersDagitStudioProvider>
      <StudioLayoutBody>{children}</StudioLayoutBody>
    </DersDagitStudioProvider>
  );
}

function StudioLayoutBody({ children }: { children: React.ReactNode }) {
  const { overview, loading, error } = useDersDagitStudio();
  const pathname = usePathname() ?? '';
  const setupDone = useMemo(() => (overview ? isSetupComplete(overview) : true), [overview]);
  const dataNav = showStudioDataNav(pathname);
  const onboarding = overview && showStudioOnboarding(pathname, setupDone);

  return (
    <div className={DD_PAGE}>
      {loading && !overview ? (
        <LoadingSpinner label="Program merkezi yükleniyor…" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <div className="space-y-2 print:hidden">
            <StudioHubBar overview={overview} />
            <div className="lg:hidden">
              <StudioMobileNav />
            </div>
            {onboarding && <StudioOnboarding overview={overview} compact />}
            {dataNav && <DersDagitStudioNav healthScore={overview?.health_score} />}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
