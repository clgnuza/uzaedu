'use client';

import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayout } from './context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Breadcrumb } from './breadcrumb';
import type { WebAdminRole } from '@/config/types';

interface MainProps {
  children: React.ReactNode;
  role: WebAdminRole | null;
}

export function Main({ children, role }: MainProps) {
  const isMobile = useIsMobile();
  const { sidebarCollapse, setSidebarCollapse } = useLayout();

  useEffect(() => {
    const c = document.body.classList;
    c.add('admin-demo');
    c.add('sidebar-fixed');
    c.add('header-fixed');
    if (sidebarCollapse) c.add('sidebar-collapse');
    else c.remove('sidebar-collapse');
    return () => {
      c.remove('admin-demo');
      c.remove('sidebar-fixed');
      c.remove('header-fixed');
      c.remove('sidebar-collapse');
    };
  }, [sidebarCollapse]);

  const handleToggleSidebar = () => setSidebarCollapse(!sidebarCollapse);

  return (
    <>
      {!isMobile && <Sidebar role={role} />}
      <div className="wrapper flex min-h-screen flex-1 flex-col">
        <Header role={role} onOpenSidebar={handleToggleSidebar} />
        <main className="grow pt-5" role="main">
          <div className="container space-y-5">
            <Breadcrumb />
            {children}
          </div>
        </main>
        <footer className="border-t border-border bg-muted/30 py-4 text-center text-xs text-muted-foreground">
          Öğretmen Pro Web Admin
        </footer>
      </div>
    </>
  );
}
