'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessRoute, getMatchedRoute } from '@/config/menu';
import type { WebAdminRole } from '@/config/types';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface RouteGuardProps {
  children: React.ReactNode;
  role: WebAdminRole | null;
  loading: boolean;
  /** Moderator için yetkili modüller (role=moderator ise kullanılır). */
  moderatorModules?: string[] | null;
  /** Teacher / school_admin için okulun enabled_modules (requiredSchoolModule kontrolü). */
  schoolEnabledModules?: string[] | null;
  /** Giriş yoksa yönlendirilecek path (örn. /login). */
  loginPath?: string;
}

/**
 * AUTHORITY_MATRIX'e göre route guard: bu sayfaya rol yetkisi yoksa /dashboard veya /403.
 * Token yoksa loginPath'e yönlendirir. Moderator için moderator_modules ile modül kontrolü yapılır.
 */
export function RouteGuard({
  children,
  role,
  loading,
  moderatorModules,
  schoolEnabledModules,
  loginPath = '/login',
}: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!role) {
      router.replace(loginPath);
      return;
    }
    const route = getMatchedRoute(pathname);
    if (!route) {
      if (pathname !== '/dashboard' && pathname !== '/') router.replace('/dashboard');
      return;
    }
    const allowed = canAccessRoute(pathname, role, moderatorModules, schoolEnabledModules);
    if (!allowed) {
      if ((pathname === '/school-reviews' || pathname.startsWith('/school-reviews/')) && role === 'school_admin') {
        router.replace('/school-reviews-report');
        return;
      }
      router.replace('/403');
    }
  }, [loading, role, moderatorModules, schoolEnabledModules, pathname, router, loginPath]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }
  if (!role) {
    return null;
  }
  if (!canAccessRoute(pathname, role, moderatorModules, schoolEnabledModules)) {
    return null;
  }
  return <>{children}</>;
}
