'use client';

import { DersDagitStudioNav } from '@/components/ders-dagit/studio-nav';
import { StudioProgramStepper } from '@/components/ders-dagit/studio-program-stepper';
import { StudioOnboarding } from '@/components/ders-dagit/studio-onboarding';
import { StudioHubBar } from '@/components/ders-dagit/StudioHubBar';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { StudioFlowSelect, StudioFullNavSelect, StudioStepSelect } from '@/components/ders-dagit/studio-menu-select';

export default function DersDagitStudioLayout({ children }: { children: React.ReactNode }) {
  const { overview, loading, error } = useDersDagitStudio();
  return (
    <div className={DD_PAGE}>
      {loading && !overview ? (
        <LoadingSpinner label="Program merkezi yükleniyor…" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <div className="grid gap-2 lg:hidden">
            <StudioFlowSelect />
            <StudioStepSelect />
          </div>
          <StudioHubBar overview={overview} />
          <StudioProgramStepper />
          <StudioOnboarding overview={overview} />
          <details className="dd-glass dd-glass-subtle print:hidden rounded-xl px-2.5 py-2 sm:px-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Tüm sayfalar
            </summary>
            <div className="space-y-3 pt-2">
              <StudioFullNavSelect />
              <DersDagitStudioNav healthScore={overview?.health_score} />
            </div>
          </details>
        </>
      )}
      {children}
    </div>
  );
}
