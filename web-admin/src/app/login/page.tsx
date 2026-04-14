'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPortalHub } from '@/components/auth/auth-portal-hub';

function LoginHubInner() {
  const sp = useSearchParams();
  const redirectQuery = sp?.toString() || undefined;
  return <AuthPortalHub flow="login" redirectQuery={redirectQuery} />;
}

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
        <LoginHubInner />
      </Suspense>
    </AuthPageShell>
  );
}
