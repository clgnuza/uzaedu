'use client';

import Link from 'next/link';
import { ChevronFirst } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayout } from '@/components/layout/context';
import { AdminShellLogoCollapsed, AdminShellLogoExpanded } from '@/components/brand/admin-shell-logo';

export function SidebarHeader() {
  const { sidebarCollapse, setSidebarCollapse } = useLayout();

  const handleToggleClick = () => setSidebarCollapse(!sidebarCollapse);

  return (
    <div className="sidebar-header hidden lg:flex items-center relative justify-between px-3 lg:px-5 shrink-0 h-[var(--header-height)] border-b border-border/60 bg-muted/20">
      <Link
        href="/dashboard"
        className={cn(
          'sidebar-logo group flex min-w-0 flex-1 items-center overflow-hidden rounded-xl px-1 py-1.5 -mx-0.5',
          'transition-[opacity,background-color] hover:bg-muted/80 hover:opacity-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        )}
        aria-label="Dashboard"
      >
        <span className="default-logo min-w-0">
          <AdminShellLogoExpanded />
        </span>
        <span className="small-logo w-full min-w-0">
          <AdminShellLogoCollapsed />
        </span>
      </Link>
      <button
        type="button"
        onClick={handleToggleClick}
        className={cn(
          'size-7 absolute start-full top-2/4 -translate-x-2/4 -translate-y-2/4 inline-flex items-center justify-center rounded-md border border-border bg-background shadow-sm hover:bg-muted',
          sidebarCollapse && 'ltr:rotate-180',
        )}
        aria-label="Kenar çubuğunu daralt / genişlet"
      >
        <ChevronFirst className="size-4" />
      </button>
    </div>
  );
}
