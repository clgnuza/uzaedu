'use client';

import { ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useLayout } from '@/components/layout/context';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';
import { ModuleContentGate } from '@/components/market/module-content-gate';
import { isPublicAdminPath } from '@/lib/public-admin-paths';
import { OGRETMEN_PRO_GUEST_SHELL_NAV } from '@/lib/guest-web-shell-preset';
import type { GuestPublicWebShellNav, WebExtrasPublic } from '@/lib/web-extras-public';
import { cn } from '@/lib/utils';
import { GuestPublicShellBottomBar } from './components/guest-public-shell';

/**
 * Metronic demo1 layout – kit’ten kopyalandı.
 * Auth ve menü proje koduna (useAuth, menu.ts, LayoutContext) bağlı.
 */
export function Demo1Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { role, me } = useAuth();
  const moderatorModules = me?.moderator_modules ?? null;
  const { sidebarCollapse } = useLayout();
  /** Giriş yok + herkese açık admin sayfası: sol menü yok, üstte misafir bağlantıları */
  const guestPublicChrome = !role && isPublicAdminPath(pathname ?? '');
  const [guestShell, setGuestShell] = useState<GuestPublicWebShellNav | null>(null);

  useEffect(() => {
    if (!guestPublicChrome) {
      setGuestShell(null);
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
    let cancelled = false;
    fetch(`${base.replace(/\/$/, '')}/content/web-extras`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WebExtrasPublic | null) => {
        if (cancelled) return;
        if (!d) {
          setGuestShell(null);
          return;
        }
        setGuestShell(d.guest_public_web_shell_nav ?? OGRETMEN_PRO_GUEST_SHELL_NAV);
      })
      .catch(() => {
        if (!cancelled) setGuestShell(null);
      });
    return () => {
      cancelled = true;
    };
  }, [guestPublicChrome]);

  const showGuestBottomNav =
    guestPublicChrome &&
    guestShell &&
    guestShell.bottom_bar_enabled &&
    guestShell.bottom_bar_items.length > 0 &&
    (!guestShell.bottom_bar_mobile_only || isMobile);

  /** useLayoutEffect sırası: önce demo1, sonra sidebar-collapse — .demo1.sidebar-collapse eşleşsin */
  useLayoutEffect(() => {
    const bodyClass = document.body.classList;
    bodyClass.add('demo1');
    if (!guestPublicChrome) bodyClass.add('sidebar-fixed');
    else bodyClass.remove('sidebar-fixed');
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
  }, [guestPublicChrome]);

  useLayoutEffect(() => {
    const bodyClass = document.body.classList;
    if (sidebarCollapse) bodyClass.add('sidebar-collapse');
    else bodyClass.remove('sidebar-collapse');
  }, [sidebarCollapse]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        İçeriğe atla
      </a>
      {!isMobile && !guestPublicChrome && (
        <Sidebar role={role} moderatorModules={moderatorModules} schoolEnabledModules={me?.school?.enabled_modules ?? null} />
      )}
      <div className="wrapper flex min-h-screen flex-1 flex-col">
        <Header
          role={role}
          moderatorModules={moderatorModules}
          schoolEnabledModules={me?.school?.enabled_modules ?? null}
          guestPublicChrome={guestPublicChrome}
          guestShellNav={guestPublicChrome ? guestShell : null}
        />
        <main
          id="main-content"
          className={cn(
            'grow min-h-[calc(100vh-var(--header-height)-2rem)]',
            'pt-1 sm:pt-3',
            showGuestBottomNav ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : 'pb-8',
          )}
          role="main"
        >
          <div className="container">
            <div
              className={cn(
                guestPublicChrome ? 'mt-0 space-y-4 sm:space-y-5' : 'mt-1 space-y-3 sm:mt-2 sm:space-y-4',
              )}
            >
              {!guestPublicChrome ? <ModuleContentGate>{children}</ModuleContentGate> : children}
            </div>
          </div>
        </main>
        <Footer />
        {guestPublicChrome && guestShell ? (
          <GuestPublicShellBottomBar nav={guestShell} isMobile={isMobile} />
        ) : null}
      </div>
    </>
  );
}

export default Demo1Layout;
