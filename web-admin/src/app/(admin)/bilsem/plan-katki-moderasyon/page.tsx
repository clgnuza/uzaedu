'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanKatkiModerasyonPanel } from '@/components/bilsem/plan-katki-moderasyon-panel';

export default function BilsemPlanKatkiModerasyonPage() {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (me?.role === 'superadmin') {
      router.replace('/bilsem-sablon?tab=plan-katki-moderasyon');
    }
  }, [loading, me?.role, router]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }
  if (me?.role === 'superadmin') {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <LoadingSpinner label="Bilsem altyapısına yönlendiriliyor…" />
      </div>
    );
  }

  return <PlanKatkiModerasyonPanel />;
}
