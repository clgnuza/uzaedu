'use client';

import { cn } from '@/lib/utils';
import { useLayout } from './context';
import { SidebarHeader } from './sidebar-header';
import { SidebarMenu } from './sidebar-menu';
import type { WebAdminRole } from '@/config/types';

interface SidebarProps {
  role: WebAdminRole | null;
}

export function Sidebar({ role }: SidebarProps) {
  const { sidebarTheme } = useLayout();

  return (
    <aside
      className={cn(
        'sidebar fixed inset-y-0 left-0 z-20 flex w-[var(--sidebar-width)] flex-col border-r border-border bg-background transition-[width] duration-300',
        sidebarTheme === 'dark' && 'dark bg-zinc-900 border-zinc-800',
      )}
    >
      <SidebarHeader />
      <div className="flex-1 overflow-y-auto">
        <SidebarMenu role={role} />
      </div>
    </aside>
  );
}
