'use client';

import Link from 'next/link';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { ValidationDashboard } from '@/components/ders-dagit/ValidationDashboard';
import { DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';

export default function DogrulamaPage() {
  const { studio, overview, refresh: refreshStudio } = useDersDagitStudio();
  const { issues, refresh, canProceed, loading } = useStudioValidation(studio?.id);

  const handleRefresh = () => {
    void refresh();
    void refreshStudio({ force: true });
  };

  return (
    <div className={DD_PAGE}>
      <ValidationDashboard
        issues={issues}
        overview={overview}
        loading={loading}
        canProceed={canProceed}
        onRefresh={handleRefresh}
      />
      {!studio && (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Stüdyo yüklenemedi.
          <Button className="mt-3" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/studyo">Özet</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
