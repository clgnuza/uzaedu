'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Menu,
  LogOut,
  User,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Palette,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayout } from '@/components/layout/context';
import { Sheet, SheetTrigger, SheetContent, SheetBody } from '@/components/ui/sheet';
import { Container } from '@/components/common/container';
import { SidebarMenu } from './sidebar-menu';
import type { WebAdminRole } from '@/config/types';
import { cn } from '@/lib/utils';
import { UserAvatarBubble } from '@/components/user-avatar';
import { AdminShellLogoHeaderMobile } from '@/components/brand/admin-shell-logo';

type AppTheme = 'light' | 'dark' | 'system';
type SidebarTheme = 'light' | 'dark';

interface HeaderProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
  schoolEnabledModules?: string[] | null;
}

export function Header({ role, moderatorModules, schoolEnabledModules }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { me, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { sidebarTheme, setSidebarTheme } = useLayout();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setSidebarSheetOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userMenuOpen]);

  const currentAppTheme: AppTheme = mounted ? (theme === 'system' ? 'system' : (theme as AppTheme) ?? 'light') : 'light';
  const currentSidebarTheme: SidebarTheme = sidebarTheme;

  const handleAppTheme = (value: AppTheme) => {
    setTheme(value);
  };

  const displayLabel = (me?.display_name || me?.email || '?').trim();
  const emailLine = me?.email?.trim();
  const showEmailSub = Boolean(me?.display_name?.trim() && emailLine);
  const schoolVerified = me?.role === 'teacher' && !!me?.school_verified;

  return (
    <header className="header fixed top-0 z-10 start-0 end-0 flex h-[var(--header-height)] shrink-0 items-stretch border-b border-border bg-background pe-[var(--removed-body-scroll-bar-size,0px)] print:hidden">
      <Container className="flex w-full items-center justify-between gap-4">
        {/* Sol: mobil menü + logo */}
        <div className="flex items-center gap-2">
          {isMobile && (
            <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Menüyü aç"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[275px] p-0">
                <SheetBody className="p-0 overflow-y-auto">
                  <SidebarMenu role={role} moderatorModules={moderatorModules} schoolEnabledModules={schoolEnabledModules} />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
          <Link
            href="/dashboard"
            className="min-w-0 max-w-[min(100%,200px)] shrink-0 rounded-xl px-1 py-0.5 transition-opacity hover:opacity-90 lg:hidden"
            aria-label="Dashboard"
          >
            <AdminShellLogoHeaderMobile />
          </Link>
        </div>

        {/* Sağ: hesap menüsü */}
        <div className="relative flex min-w-0 items-center justify-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'group flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border border-border/80 bg-card py-1 pl-1 pr-2 shadow-sm transition-all',
                'hover:border-primary/25 hover:bg-muted/40 hover:shadow-md',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                userMenuOpen && 'border-primary/35 bg-muted/30 ring-2 ring-ring/40 ring-offset-2 ring-offset-background',
              )}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="Hesap menüsü"
            >
              <UserAvatarBubble
                avatarKey={me?.avatar_key}
                avatarUrl={me?.avatar_url}
                displayName={displayLabel}
                email={me?.email}
                size="sm"
                className="!ring-0 shadow-inner"
                verified={schoolVerified}
              />
              <span className="hidden max-w-[min(160px,28vw)] truncate text-left text-sm font-medium text-foreground sm:block">
                {displayLabel}
              </span>
              <ChevronDown
                className={cn(
                  'hidden size-4 shrink-0 text-muted-foreground transition-transform sm:block',
                  userMenuOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-1rem),20rem)] origin-top-right rounded-2xl border border-border/80 bg-popover p-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
                  role="menu"
                >
                  <div className="border-b border-border/80 bg-muted/30 px-4 py-3">
                    <div className="flex gap-3">
                      <UserAvatarBubble
                        avatarKey={me?.avatar_key}
                        avatarUrl={me?.avatar_url}
                        displayName={displayLabel}
                        email={me?.email}
                        size="md"
                        className="!rounded-xl !ring-0 shadow-sm"
                        verified={schoolVerified}
                      />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-sm font-semibold leading-tight text-foreground">{displayLabel}</p>
                        {showEmailSub ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{emailLine}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="rounded-xl border border-border/60 bg-muted/25 p-3 dark:bg-muted/15">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Palette className="size-3.5 text-primary" aria-hidden />
                        Tema
                      </div>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/80 p-1 shadow-inner dark:bg-background/40">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('light')}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium transition-all',
                            currentAppTheme === 'light'
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                          )}
                          title="Açık tema"
                        >
                          <Sun className="size-4" aria-hidden />
                          Açık
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('dark')}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium transition-all',
                            currentAppTheme === 'dark'
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                          )}
                          title="Koyu tema"
                        >
                          <Moon className="size-4" aria-hidden />
                          Koyu
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('system')}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium transition-all',
                            currentAppTheme === 'system'
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                          )}
                          title="Sistem teması"
                        >
                          <Monitor className="size-4" aria-hidden />
                          Sistem
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/25 p-3 dark:bg-muted/15">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <PanelLeft className="size-3.5 text-primary" aria-hidden />
                        Kenar çubuğu
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-background/80 p-1 shadow-inner dark:bg-background/40">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setSidebarTheme('light')}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium transition-all',
                            currentSidebarTheme === 'light'
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                          )}
                          title="Açık kenar çubuğu"
                        >
                          <Sun className="size-4 shrink-0" aria-hidden />
                          Açık
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setSidebarTheme('dark')}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium transition-all',
                            currentSidebarTheme === 'dark'
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                          )}
                          title="Koyu kenar çubuğu"
                        >
                          <Moon className="size-4 shrink-0" aria-hidden />
                          Koyu
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/80 bg-card/50 p-1.5">
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <User className="size-4" aria-hidden />
                      </span>
                      Profil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                        router.refresh();
                      }}
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <LogOut className="size-4" aria-hidden />
                      </span>
                      Çıkış
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
