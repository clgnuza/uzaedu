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

export function Sidebar({ role, moderatorModules, schoolEnabledModules }: SidebarProps) {
  const { sidebarTheme } = useLayout();

  return (
    <div
      className={cn(
        'sidebar bg-background lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-40 flex flex-col items-stretch shrink-0 print:hidden',
        sidebarTheme === 'dark' && 'dark',
      )}
    >
      <SidebarHeader />
      <div className="overflow-hidden">
        <div className="sidebar-inner w-full min-w-0">
          <Suspense fallback={<div className="px-3 py-4 text-xs text-muted-foreground">Menü yükleniyor…</div>}>
            <SidebarMenu role={role} moderatorModules={moderatorModules} schoolEnabledModules={schoolEnabledModules} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
