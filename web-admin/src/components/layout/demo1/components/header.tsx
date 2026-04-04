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
import {
  WEB_PUBLIC_DEFAULT_HEADER,
  type WebPublicConfig,
  type WebPublicHeaderShellStyle,
} from '@/components/web-settings/web-public-panel';
import { getApiUrl } from '@/lib/api';
import type { GuestPublicWebShellNav } from '@/lib/web-extras-public';
import { GuestPublicShellTopBar } from './guest-public-shell';

function headerShellClassName(
  style: WebPublicHeaderShellStyle,
  opts?: { loggedInScrollbarPad?: boolean },
): string {
  return cn(
    'header relative fixed top-0 z-30 start-0 end-0 flex h-(--header-height) shrink-0 items-stretch print:hidden',
    opts?.loggedInScrollbarPad && 'pe-(--removed-body-scroll-bar-size,0px)',
    style === 'solid' && 'border-b border-border bg-background shadow-sm',
    style === 'minimal' && 'border-b border-border/35 bg-background/70 backdrop-blur-md',
    style === 'brand' &&
      'border-b border-primary/30 bg-gradient-to-b from-primary/[0.09] to-background shadow-sm dark:from-primary/[0.14]',
    style === 'glass' &&
      'border-b border-border/40 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/70 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:border-border dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]',
  );
}

type AppTheme = 'light' | 'dark' | 'system';
type SidebarTheme = 'light' | 'dark';

function guestPublicBrandSubtitle(pathname: string): string {
  const p = (pathname || '').split('?')[0] || '';
  if (p === '/extra-lesson-calc') return 'Ek ders ücreti hesaplama';
  if (p === '/hesaplamalar') return 'Hesaplamalar';
  if (p === '/sinav-gorev-ucretleri') return 'Sınav görev ücretleri';
  if (p === '/haberler/yayin') return 'Yayın';
  if (p === '/haberler') return 'Haberler';
  if (p === '/okul-degerlendirmeleri' || p.startsWith('/okul-degerlendirmeleri/')) return 'Okul değerlendirmeleri';
  return 'Herkese açık';
}

interface HeaderProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
  schoolEnabledModules?: string[] | null;
  /** Giriş yok + herkese açık sayfa: sol menü yok, üstte anasayfa / panele git / giriş */
  guestPublicChrome?: boolean;
  /** GET /content/web-extras — misafir üst şerit (superadmin Web ayarları → Kabuk) */
  guestShellNav?: GuestPublicWebShellNav | null;
}

export function Header({
  role,
  moderatorModules,
  schoolEnabledModules,
  guestPublicChrome,
  guestShellNav,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { me, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { sidebarTheme, setSidebarTheme } = useLayout();
  const [mounted, setMounted] = useState(false);
  const [headerPublicCfg, setHeaderPublicCfg] = useState<Pick<
    WebPublicConfig,
    | 'header_brand_subtitle'
    | 'header_shell_style'
    | 'header_shell_density'
    | 'header_shell_accent'
  > | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/content/web-public'), { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<WebPublicConfig> | null) => {
        if (!d) return;
        const st = d.header_shell_style;
        const shellStyle: WebPublicHeaderShellStyle =
          st === 'solid' || st === 'minimal' || st === 'brand' ? st : 'glass';
        const dens = d.header_shell_density;
        const density =
          dens === 'compact' || dens === 'comfortable' ? dens : WEB_PUBLIC_DEFAULT_HEADER.header_shell_density;
        setHeaderPublicCfg({
          header_brand_subtitle: d.header_brand_subtitle ?? WEB_PUBLIC_DEFAULT_HEADER.header_brand_subtitle,
          header_shell_style: shellStyle,
          header_shell_density: density,
          header_shell_accent:
            d.header_shell_accent === false ? false : (d.header_shell_accent ?? WEB_PUBLIC_DEFAULT_HEADER.header_shell_accent),
        });
      })
      .catch(() => setHeaderPublicCfg(null));
  }, []);

  useEffect(() => {
    const density = headerPublicCfg?.header_shell_density ?? WEB_PUBLIC_DEFAULT_HEADER.header_shell_density;
    const compact = 'header-shell-density-compact';
    const comfortable = 'header-shell-density-comfortable';
    document.body.classList.remove(compact, comfortable);
    if (density === 'compact') document.body.classList.add(compact);
    else if (density === 'comfortable') document.body.classList.add(comfortable);
    return () => {
      document.body.classList.remove(compact, comfortable);
    };
  }, [headerPublicCfg?.header_shell_density]);

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

  const loginReturnTo = encodeURIComponent(pathname || '/');

  const shellStyle = headerPublicCfg?.header_shell_style ?? WEB_PUBLIC_DEFAULT_HEADER.header_shell_style;
  const logoSubtitleConfigured = headerPublicCfg?.header_brand_subtitle?.trim();
  const showAccent =
    (shellStyle === 'glass' || shellStyle === 'brand') &&
    (headerPublicCfg?.header_shell_accent ?? WEB_PUBLIC_DEFAULT_HEADER.header_shell_accent);

  if (guestPublicChrome) {
    const brandSub = logoSubtitleConfigured || guestPublicBrandSubtitle(pathname ?? '');
    return (
      <header className={headerShellClassName(shellStyle)}>
        {showAccent ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-primary/28 to-transparent"
            aria-hidden
          />
        ) : null}
        <Container className="flex h-full w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto sm:gap-3">
          <Link
            href="/"
            className="min-w-0 max-w-[min(100%,min(280px,85vw))] shrink-0 rounded-lg px-0.5 py-0.5 outline-offset-2 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Ana sayfaya dön — Öğretmen Pro"
          >
            <AdminShellLogoHeaderMobile subtitle={brandSub} />
          </Link>
          <div className="min-w-0 flex-1">{guestShellNav ? <GuestPublicShellTopBar nav={guestShellNav} /> : null}</div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
            <div className="flex items-center rounded-full border border-border/70 bg-muted/40 p-0.5 dark:bg-muted/25">
              <button
                type="button"
                onClick={() => handleAppTheme('light')}
                className={cn(
                  'rounded-full p-2 transition-colors',
                  currentAppTheme === 'light'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Açık tema"
              >
                <Sun className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAppTheme('dark')}
                className={cn(
                  'rounded-full p-2 transition-colors',
                  currentAppTheme === 'dark'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Koyu tema"
              >
                <Moon className="size-4" />
              </button>
            </div>
            <Link
              href="/login?redirect=%2Fdashboard"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-3.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted sm:text-sm"
            >
              Panele git
            </Link>
            <Link
              href={`/login?redirect=${loginReturnTo}`}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:text-sm"
            >
              Giriş yap
            </Link>
          </div>
        </Container>
      </header>
    );
  }

  return (
    <header className={headerShellClassName(shellStyle, { loggedInScrollbarPad: true })}>
      {showAccent ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-primary/28 to-transparent"
          aria-hidden
        />
      ) : null}
      <Container className="flex w-full items-center justify-between gap-2 sm:gap-4">
        {/* Sol: mobil menü + logo */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
            className="min-w-0 max-w-[min(100%,160px)] shrink-0 rounded-xl px-1 py-0.5 transition-opacity hover:opacity-90 sm:max-w-[min(100%,200px)] lg:hidden"
            aria-label="Dashboard"
          >
            <AdminShellLogoHeaderMobile subtitle={logoSubtitleConfigured || undefined} />
          </Link>
        </div>

        {/* Sağ: hesap menüsü */}
        <div className="relative flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'group flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border border-border/80 bg-card py-1 pl-1 pr-1.5 shadow-sm transition-all sm:gap-2 sm:pr-2',
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
                className="ring-0! shadow-inner"
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
                        className="rounded-xl! ring-0! shadow-sm"
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
