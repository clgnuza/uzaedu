'use client';

import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PardusKurulumWizard } from '@/components/pardus-kurulum/PardusKurulumWizard';

export default function PardusKurulumPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      }
    >
      <PardusKurulumWizard />
    </Suspense>
  );
}
