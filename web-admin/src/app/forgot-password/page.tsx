'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoadingDots } from '@/components/ui/loading-spinner';

function RedirectInner() {
  const sp = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const q = sp?.toString();
    router.replace(q ? `/forgot-password/ogretmen?${q}` : '/forgot-password/ogretmen');
  }, [sp, router]);
  return (
    <p className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
      <LoadingDots />
    </p>
  );
}

export default function ForgotPasswordLegacyRedirectPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <RedirectInner />
    </Suspense>
  );
}
