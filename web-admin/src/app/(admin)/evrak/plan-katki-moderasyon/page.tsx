'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanIcerikKatkiModerasyonPanel } from '@/components/yillik-plan/plan-katki-moderasyon-panel';

export default function EvrakPlanKatkiModerasyonPage() {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (me?.role === 'superadmin') router.replace('/document-templates?tab=plan-katki-moderasyon');
  }, [loading, me?.role, router]);

  if (loading) {
    return <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner label="Yükleniyor…" /></div>;
  }
  if (me?.role === 'superadmin') {
    return <div className="flex min-h-[30vh] items-center justify-center"><LoadingSpinner label="Yönlendiriliyor…" /></div>;
  }
  return <PlanIcerikKatkiModerasyonPanel />;
}
