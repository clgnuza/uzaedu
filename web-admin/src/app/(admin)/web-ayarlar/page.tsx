'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WebSettingsTabs } from '@/components/web-settings/web-settings-tabs';

export default function WebAyarlarPage() {
  const { me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (me && me.role !== 'superadmin') {
      router.replace('/403');
    }
  }, [me, router]);

  if (!me) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }
  if (me.role !== 'superadmin') return null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sistem</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Web ve mobil ayarlar</h1>
        <p className="text-sm text-muted-foreground">Kamu sayfa, SEO, e-posta, depolama ve mobil istemci.</p>
      </header>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        }
      >
        <WebSettingsTabs />
      </Suspense>
    </div>
  );
}
