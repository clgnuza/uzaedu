'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPortalHub } from '@/components/auth/auth-portal-hub';

function RegisterHubInner() {
  const sp = useSearchParams();
  return <AuthPortalHub flow="register" redirectQuery={sp?.toString() || undefined} />;
}

export default function RegisterHubPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
        <RegisterHubInner />
      </Suspense>
    </AuthPageShell>
  );
}
