'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingDots } from '@/components/ui/loading-spinner';

function RedirectInner() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const s = sp.toString();
    router.replace(s ? `/register/okul?${s}` : '/register/okul');
  }, [router, sp]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <LoadingDots />
    </div>
  );
}

export default function RegisterOkulLegacyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <LoadingDots />
        </div>
      }
    >
      <RedirectInner />
    </Suspense>
  );
}
