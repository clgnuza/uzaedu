'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthFlowSubnav } from '@/components/auth/auth-flow-subnav';
import { TeacherLoginForm } from '@/components/auth/teacher-login-form';

function Subnav() {
  const sp = useSearchParams();
  return <AuthFlowSubnav flow="login" role="teacher" redirectQuery={sp?.toString() || undefined} />;
}

export default function OgretmenLoginPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
        <Subnav />
        <TeacherLoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
