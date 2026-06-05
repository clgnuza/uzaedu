'use client';

import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { useLayout } from '@/components/layout/context';
import { SidebarHeader } from './sidebar-header';
import { SidebarMenu } from './sidebar-menu';
import type { WebAdminRole } from '@/config/types';

interface SidebarProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
  schoolEnabledModules?: string[] | null;
}

/** Masaüstü kenar çubuğu + mobil Sheet menüsü — koyu tema `dark` kapsayıcısı */
export function sidebarShellClassName(sidebarTheme: 'light' | 'dark', extra?: string) {
  return cn(
    'sidebar bg-background text-foreground',
    sidebarTheme === 'dark' && 'dark bg-zinc-900 border-zinc-800',
    extra,
  );
}

export function Sidebar({ role, moderatorModules, schoolEnabledModules }: SidebarProps) {
  const { sidebarTheme } = useLayout();

  return (
    <div
      className={sidebarShellClassName(
        sidebarTheme,
        'lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-40 flex min-h-0 flex-col items-stretch print:hidden lg:max-h-dvh lg:shrink-0',
      )}
    >
      <SidebarHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="sidebar-inner flex min-h-0 min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="px-3 py-4 text-xs text-muted-foreground">Menü yükleniyor…</div>}>
            <SidebarMenu role={role} moderatorModules={moderatorModules} schoolEnabledModules={schoolEnabledModules} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
