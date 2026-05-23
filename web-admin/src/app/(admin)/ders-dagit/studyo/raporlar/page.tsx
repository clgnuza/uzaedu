'use client';

import { Suspense } from 'react';
import { ReportHub } from '@/components/ders-dagit/ReportHub';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function StudioRaporlarPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Raporlar…" />}>
      <ReportHub />
    </Suspense>
  );
}
