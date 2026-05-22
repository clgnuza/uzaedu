'use client';

import { DersDagitStudioNav } from '@/components/ders-dagit/studio-nav';
import { StudioProgramStepper } from '@/components/ders-dagit/studio-program-stepper';
import { StudioOnboarding } from '@/components/ders-dagit/studio-onboarding';
import { StudioHubBar } from '@/components/ders-dagit/StudioHubBar';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function DersDagitStudioLayout({ children }: { children: React.ReactNode }) {
  const { overview, loading, error } = useDersDagitStudio();
  return (
    <div className="space-y-4">
      {loading && !overview ? (
        <LoadingSpinner label="Stüdyo yükleniyor…" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <StudioHubBar overview={overview} />
          <StudioProgramStepper />
          <StudioOnboarding overview={overview} />
          <details className="print:hidden rounded-lg border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Tüm stüdyo menüsü</summary>
            <div className="pt-2">
              <DersDagitStudioNav healthScore={overview?.health_score} />
            </div>
          </details>
        </>
      )}
      {children}
    </div>
  );
}
