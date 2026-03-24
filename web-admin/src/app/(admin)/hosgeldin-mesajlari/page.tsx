'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WelcomeModulePanel } from '@/components/web-settings/welcome-module-panel';

export default function HosgeldinMesajlariPage() {
  const { me } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (me && me.role !== 'superadmin') {
      router.replace('/403');
    }
  }, [me, router]);

  if (!me) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }
  if (me.role !== 'superadmin') return null;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-4">
      <WelcomeModulePanel />
    </div>
  );
}
