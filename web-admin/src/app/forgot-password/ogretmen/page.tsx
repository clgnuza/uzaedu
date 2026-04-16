'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ForgotPasswordView } from '@/components/auth/forgot-password-view';

function Inner() {
  const sp = useSearchParams();
  const q = sp?.toString() || undefined;
  return <ForgotPasswordView role="teacher" redirectQuery={q} />;
}

export default function ForgotPasswordTeacherPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <Inner />
    </Suspense>
  );
}
