'use client';

import { LayoutProvider } from './context';
import { Demo1Layout } from './demo1/layout';
import { useAuth } from '@/hooks/use-auth';
import { RouteGuard } from '@/guards/route-guard';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Metronic demo1 layout – kit’ten kopyalandı, auth/menü projeye bağlı.
 * Route guard ve menü AUTHORITY_MATRIX'e göre rol ile filtrelenir.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const { role, loading, me } = useAuth();

  return (
    <LayoutProvider>
      <RouteGuard
        role={role}
        loading={loading}
        moderatorModules={me?.moderator_modules ?? null}
        schoolEnabledModules={me?.school?.enabled_modules ?? null}
        loginPath="/login"
      >
        <Demo1Layout>{children}</Demo1Layout>
      </RouteGuard>
    </LayoutProvider>
  );
}
