'use client';

import { DersDagitStudioNav } from '@/components/ders-dagit/studio-nav';
import { StudioOnboarding } from '@/components/ders-dagit/studio-onboarding';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function DersDagitStudioLayout({ children }: { children: React.ReactNode }) {
  const { overview, loading, error } = useDersDagitStudio();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DersDağıt Program Stüdyosu</h1>
        <p className="text-sm text-muted-foreground">
          Ders ataması, gruplar, kurallar ve otomatik üretim — mevcut ders programından bağımsız motor.
        </p>
      </div>
      {loading && !overview ? (
        <LoadingSpinner label="Stüdyo yükleniyor…" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <DersDagitStudioNav healthScore={overview?.health_score} />
          <StudioOnboarding overview={overview} />
        </>
      )}
      {children}
    </div>
  );
}
