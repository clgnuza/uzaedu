'use client';

import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { StudioReadinessDashboard } from '@/components/ders-dagit/StudioReadinessDashboard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function StudioDashboardPage() {
  const { overview, loading } = useDersDagitStudio();
  if (loading && !overview) return <LoadingSpinner label="Özet…" />;
  if (!overview) return null;
  return <StudioReadinessDashboard overview={overview} />;
}
