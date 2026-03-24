'use client';

import { ReactNode, useLayoutEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useLayout } from '@/components/layout/context';
import { Breadcrumb } from './components/breadcrumb';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';
import { ModuleEntryFeeBanner } from '@/components/market/module-entry-fee-banner';

/**
 * Metronic demo1 layout – kit’ten kopyalandı.
 * Auth ve menü proje koduna (useAuth, menu.ts, LayoutContext) bağlı.
 */
export function Demo1Layout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { role, me } = useAuth();
  const moderatorModules = me?.moderator_modules ?? null;
  const { sidebarCollapse } = useLayout();

  /** useLayoutEffect sırası: önce demo1, sonra sidebar-collapse — .demo1.sidebar-collapse eşleşsin */
  useLayoutEffect(() => {
    const bodyClass = document.body.classList;
    bodyClass.add('demo1');
    bodyClass.add('sidebar-fixed');
    bodyClass.add('header-fixed');
    let rafId = 0;
    rafId = requestAnimationFrame(() => {
      bodyClass.add('layout-initialized');
    });
    return () => {
      bodyClass.remove('demo1');
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.remove('header-fixed');
      bodyClass.remove('layout-initialized');
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useLayoutEffect(() => {
    const bodyClass = document.body.classList;
    if (sidebarCollapse) bodyClass.add('sidebar-collapse');
    else bodyClass.remove('sidebar-collapse');
  }, [sidebarCollapse]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        İçeriğe atla
      </a>
      {!isMobile && <Sidebar role={role} moderatorModules={moderatorModules} schoolEnabledModules={me?.school?.enabled_modules ?? null} />}
      <div className="wrapper flex min-h-screen flex-1 flex-col">
        <Header role={role} moderatorModules={moderatorModules} schoolEnabledModules={me?.school?.enabled_modules ?? null} />
        <main id="main-content" className="grow pt-5 min-h-[calc(100vh-var(--header-height)-2rem)] pb-8" role="main">
          <div className="container">
            <div className="border-b border-border/30 pb-3.5 sm:pb-4">
              <Breadcrumb />
            </div>
            <div className="mt-5 space-y-5">
              <ModuleEntryFeeBanner />
              {children}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default Demo1Layout;
