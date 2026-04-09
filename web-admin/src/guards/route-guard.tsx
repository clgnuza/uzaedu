'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessRoute, getMatchedRoute } from '@/config/menu';
import type { WebAdminRole } from '@/config/types';
import { AppShellLoadingCard } from '@/components/ui/app-shell-loading-card';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { isPublicAdminPath } from '@/lib/public-admin-paths';

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
  const { supportEnabled } = useSupportModuleAvailability();
  const supportEnabledValue = supportEnabled ?? true;

  useEffect(() => {
    if (loading) return;
    if (!role) {
      if (isPublicAdminPath(pathname)) return;
      router.replace(loginPath);
      return;
    }
    const route = getMatchedRoute(pathname);
    if (!route) {
      if (pathname !== '/dashboard' && pathname !== '/') router.replace('/dashboard');
      return;
    }
    const allowed = canAccessRoute(pathname, role, moderatorModules, schoolEnabledModules, supportEnabledValue);
    if (!allowed) {
      router.replace('/403');
    }
  }, [loading, role, moderatorModules, schoolEnabledModules, pathname, router, loginPath, supportEnabledValue]);

  if (loading) {
    return (
      <div className="w-full min-h-[min(100dvh,48rem)] bg-muted/20 dark:bg-muted/10">
        <AppShellLoadingCard
          title="Öğretmen Pro"
          subtitle="Yükleniyor…"
          hint="Oturum ve sayfa yetkileri kontrol ediliyor."
        />
      </div>
    );
  }
  if (!role) {
    if (isPublicAdminPath(pathname)) return <>{children}</>;
    return null;
  }
  if (!canAccessRoute(pathname, role, moderatorModules, schoolEnabledModules, supportEnabledValue)) {
    return null;
  }
  return <>{children}</>;
}
