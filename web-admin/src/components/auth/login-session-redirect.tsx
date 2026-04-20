'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getPostLoginRedirect } from '@/lib/post-login-redirect';

export function LoginSessionRedirect() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading || !me) return;
    const redirect = searchParams.get('redirect');
    router.replace(getPostLoginRedirect(redirect));
  }, [loading, me, router, searchParams]);

  return null;
}
