'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Inbox,
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
import { fetchWebPublicPartial } from '@/lib/fetch-web-public';
import type { GuestPublicWebShellNav } from '@/lib/web-extras-public';
import { GuestPublicShellTopBar } from './guest-public-shell';

/** Üst şerit: neon atmosfer + cam — logo ile uyumlu */
function headerShellClassName(
  style: WebPublicHeaderShellStyle,
  opts?: { loggedInScrollbarPad?: boolean },
): string {
  const neonGlassBg =
    'border-b border-border/45 bg-[radial-gradient(ellipse_110%_90%_at_8%_-48%,rgba(251,113,133,0.2),transparent_56%),radial-gradient(ellipse_100%_78%_at_96%_-40%,rgba(34,211,238,0.16),transparent_54%),radial-gradient(ellipse_75%_55%_at_52%_118%,rgba(139,92,246,0.1),transparent_52%),linear-gradient(180deg,color-mix(in_srgb,var(--color-background)_84%,transparent)_0%,color-mix(in_srgb,var(--color-background)_70%,transparent)_100%)] backdrop-blur-xl supports-backdrop-filter:backdrop-blur-2xl dark:bg-[radial-gradient(ellipse_115%_92%_at_6%_-46%,rgba(251,113,133,0.28),transparent_58%),radial-gradient(ellipse_105%_80%_at_98%_-36%,rgba(34,211,238,0.22),transparent_55%),radial-gradient(ellipse_80%_58%_at_50%_120%,rgba(167,139,250,0.16),transparent_52%),linear-gradient(180deg,color-mix(in_srgb,var(--color-background)_78%,transparent)_0%,color-mix(in_srgb,var(--color-background)_62%,transparent)_100%)]';
  const neonGlassShadow =
    'shadow-[0_1px_0_0_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.1)] dark:border-border/55 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.07),inset_0_1px_0_0_rgba(255,255,255,0.05)]';

  return cn(
    'header relative isolate fixed top-0 z-30 start-0 end-0 flex h-(--header-height) shrink-0 items-stretch print:hidden',
    opts?.loggedInScrollbarPad && 'pe-(--removed-body-scroll-bar-size,0px)',
    style === 'solid' &&
      'border-b border-border bg-[radial-gradient(ellipse_90%_70%_at_12%_-35%,rgba(251,113,133,0.1),transparent_50%),radial-gradient(ellipse_85%_65%_at_88%_-30%,rgba(34,211,238,0.08),transparent_48%),linear-gradient(180deg,var(--color-background)_0%,color-mix(in_srgb,var(--color-background)_96%,#fafafa)_100%)] shadow-sm dark:bg-[radial-gradient(ellipse_95%_75%_at_10%_-38%,rgba(251,113,133,0.16),transparent_52%),radial-gradient(ellipse_90%_70%_at_92%_-32%,rgba(34,211,238,0.12),transparent_50%),linear-gradient(180deg,var(--color-background)_0%,color-mix(in_srgb,var(--color-background)_94%,#0a0a0c)_100%)]',
    style === 'minimal' &&
      cn(
        'border-b border-border/40 bg-[radial-gradient(ellipse_100%_85%_at_10%_-42%,rgba(251,113,133,0.14),transparent_54%),radial-gradient(ellipse_95%_72%_at_94%_-36%,rgba(34,211,238,0.11),transparent_52%),linear-gradient(180deg,color-mix(in_srgb,var(--color-background)_76%,transparent)_0%,color-mix(in_srgb,var(--color-background)_64%,transparent)_100%)] backdrop-blur-md',
        neonGlassShadow,
      ),
    style === 'brand' &&
      'border-b border-primary/35 bg-[radial-gradient(ellipse_95%_80%_at_15%_-45%,rgba(251,113,133,0.18),transparent_55%),radial-gradient(ellipse_90%_70%_at_90%_-38%,rgba(34,211,238,0.14),transparent_52%),linear-gradient(to_bottom,color-mix(in_srgb,var(--primary)_12%,var(--color-background))_0%,var(--color-background)_100%)] shadow-sm dark:bg-[radial-gradient(ellipse_100%_85%_at_12%_-42%,rgba(251,113,133,0.22),transparent_56%),radial-gradient(ellipse_95%_75%_at_92%_-35%,rgba(34,211,238,0.18),transparent_54%),linear-gradient(to_bottom,color-mix(in_srgb,var(--primary)_18%,var(--color-background))_0%,var(--color-background)_100%)]',
    style === 'glass' && cn(neonGlassBg, neonGlassShadow),
  );
}

type AppTheme = 'light' | 'dark' | 'system';
type SidebarTheme = 'light' | 'dark';

function guestPublicBrandSubtitle(pathname: string): string {
  const p = (pathname || '').split('?')[0] || '';
  if (p === '/ek-ders-hesaplama') return 'Ek ders ücreti hesaplama';
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
  const userMenuAnchorRef = useRef<HTMLDivElement>(null);
  const [userMenuPlacement, setUserMenuPlacement] = useState<{
    top: number;
    right: number;
    maxWidth: number;
    maxHeight: number;
  } | null>(null);
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
    fetchWebPublicPartial()
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

  // Mobil: aşağı kaydırınca gizle, yukarı kaydırınca göster
  const [hideHeader, setHideHeader] = useState(false);
  useEffect(() => {
    if (!isMobile) { setHideHeader(false); return; }
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (delta > 4 && y > 60) setHideHeader(true);   // aşağı
        else if (delta < -4) setHideHeader(false);         // yukarı
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  /** Mobil header kaydırınca gizlenince sticky çubuklar hâlâ eski ofsette kalmasın (ör. akademik takvim). */
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty('--app-header-sticky-top');
      return;
    }
    document.documentElement.style.setProperty(
      '--app-header-sticky-top',
      hideHeader ? '0px' : 'var(--header-height)',
    );
    return () => {
      document.documentElement.style.removeProperty('--app-header-sticky-top');
    };
  }, [isMobile, hideHeader]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userMenuOpen]);

  useLayoutEffect(() => {
    if (!userMenuOpen) {
      setUserMenuPlacement(null);
      return;
    }
    const update = () => {
      const el = userMenuAnchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;
      const maxW = isMobile ? Math.min(252, vw - pad * 2) : Math.min(320, vw - 24);
      const maxH = isMobile ? Math.min(vh * 0.62, 340) : Math.min(vh * 0.72, 520);
      setUserMenuPlacement({
        top: r.bottom + 6,
        right: vw - r.right,
        maxWidth: maxW,
        maxHeight: maxH,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [userMenuOpen, isMobile]);

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

  const hideCls = isMobile && hideHeader
    ? '-translate-y-full shadow-none'
    : 'translate-y-0';
  const transitionCls = 'transition-transform duration-300 ease-in-out';

  if (guestPublicChrome) {
    const brandSub = logoSubtitleConfigured || guestPublicBrandSubtitle(pathname ?? '');
    return (
      <header className={cn(headerShellClassName(shellStyle), transitionCls, hideCls)}>
        {/* Üstten alta ışık süzmesi */}
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute inset-x-0 top-0 h-full"
            style={{
              background:
                'radial-gradient(ellipse 70% 140% at 50% -5%, rgba(139,92,246,0.13) 0%, rgba(99,102,241,0.07) 38%, transparent 70%),' +
                'linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 48%, transparent 100%)',
            }}
          />
          {/* Işık huzmesi soldan */}
          <div
            className="absolute -left-8 top-0 h-full w-1/3"
            style={{
              background:
                'conic-gradient(from 105deg at 0% 0%, rgba(251,113,133,0.10) 0deg, transparent 35deg)',
            }}
          />
          {/* Işık huzmesi sağdan */}
          <div
            className="absolute -right-8 top-0 h-full w-1/3"
            style={{
              background:
                'conic-gradient(from -105deg at 100% 0%, rgba(34,211,238,0.09) 0deg, transparent 35deg)',
            }}
          />
        </div>
        {/* Üst parlak çizgi */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[1.5px]"
          aria-hidden
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.55) 25%, rgba(255,255,255,0.7) 50%, rgba(34,211,238,0.55) 75%, transparent 100%)',
          }}
        />
        <Container className="flex h-full w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto sm:gap-3">
          <Link
            href="/"
            className={cn(
              'min-w-0 rounded-lg px-0.5 py-0.5 outline-offset-2 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
              guestShellNav ? 'shrink-0' : 'flex-1',
            )}
            aria-label="Ana sayfaya dön — Uzaedu Öğretmen"
          >
            <AdminShellLogoHeaderMobile subtitle={brandSub} />
          </Link>
          {guestShellNav ? (
            <div className="min-w-0 flex-1">
              <GuestPublicShellTopBar nav={guestShellNav} />
            </div>
          ) : null}
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
    <header className={cn(headerShellClassName(shellStyle, { loggedInScrollbarPad: true }), transitionCls, hideCls)}>
      {/* Üstten alta ışık süzmesi */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{
            background:
              'radial-gradient(ellipse 70% 140% at 50% -5%, rgba(139,92,246,0.13) 0%, rgba(99,102,241,0.07) 38%, transparent 70%),' +
              'linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 48%, transparent 100%)',
          }}
        />
        <div
          className="absolute -left-8 top-0 h-full w-1/3"
          style={{
            background:
              'conic-gradient(from 105deg at 0% 0%, rgba(251,113,133,0.10) 0deg, transparent 35deg)',
          }}
        />
        <div
          className="absolute -right-8 top-0 h-full w-1/3"
          style={{
            background:
              'conic-gradient(from -105deg at 100% 0%, rgba(34,211,238,0.09) 0deg, transparent 35deg)',
          }}
        />
      </div>
      {/* Üst parlak çizgi */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[1.5px]"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.55) 25%, rgba(255,255,255,0.7) 50%, rgba(34,211,238,0.55) 75%, transparent 100%)',
        }}
      />
      <Container className="flex w-full items-center justify-between gap-2 sm:gap-4">
        {/* Sol: mobil menü + logo */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          {isMobile && (
            <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-xl p-2.5 text-muted-foreground transition-[color,transform,background-color] hover:bg-muted/80 hover:text-foreground active:scale-[0.97]"
                  aria-label="Menüyü aç"
                >
                  <Menu className="size-[1.125rem] stroke-[1.75]" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="!w-[min(88vw,280px)] !max-w-[280px] gap-0 border-r p-0"
              >
                <SheetBody className="min-h-0 p-0">
                  <SidebarMenu
                    role={role}
                    moderatorModules={moderatorModules}
                    schoolEnabledModules={schoolEnabledModules}
                    compact
                  />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
          <Link
            href="/dashboard"
            className="min-w-0 flex-1 rounded-xl px-1 py-1 transition-opacity hover:opacity-90 lg:hidden"
            aria-label="Dashboard"
          >
            <AdminShellLogoHeaderMobile subtitle={logoSubtitleConfigured || undefined} />
          </Link>
        </div>

        {/* Sağ: hesap menüsü */}
        <div className="relative flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <div className="relative" ref={userMenuAnchorRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'group flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border border-transparent bg-gradient-to-r from-violet-500/10 via-fuchsia-500/8 to-cyan-500/10 py-1 pl-1 pr-1.5 shadow-sm ring-1 ring-border/60 transition-all sm:gap-2 sm:pr-2',
                'hover:from-violet-500/15 hover:via-fuchsia-500/12 hover:to-cyan-500/15 hover:shadow-md dark:from-violet-500/15 dark:via-fuchsia-500/10 dark:to-cyan-500/12',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                userMenuOpen &&
                  'border-violet-400/30 bg-gradient-to-r from-violet-500/18 via-fuchsia-500/14 to-cyan-500/16 ring-2 ring-violet-400/35 ring-offset-2 ring-offset-background dark:from-violet-500/22',
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
            {mounted &&
              userMenuOpen &&
              userMenuPlacement &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[200] touch-manipulation bg-zinc-950/50 dark:bg-black/60"
                    aria-hidden
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    className={cn(
                      'fixed z-[201] overflow-y-auto overscroll-contain rounded-xl border border-border bg-background shadow-2xl',
                      'dark:border-zinc-800 dark:bg-zinc-950',
                    )}
                    style={{
                      top: userMenuPlacement.top,
                      right: userMenuPlacement.right,
                      width: userMenuPlacement.maxWidth,
                      maxHeight: userMenuPlacement.maxHeight,
                    }}
                    role="menu"
                    aria-label="Hesap menüsü"
                  >
                    <div className="border-b border-border bg-muted px-3 py-2.5 dark:bg-zinc-900">
                      <div className="flex gap-2">
                        <UserAvatarBubble
                          avatarKey={me?.avatar_key}
                          avatarUrl={me?.avatar_url}
                          displayName={displayLabel}
                          email={me?.email}
                          size={isMobile ? 'sm' : 'md'}
                          className="rounded-xl! ring-1! ring-border shadow-sm"
                          verified={schoolVerified}
                        />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">{displayLabel}</p>
                          {showEmailSub ? (
                            <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">{emailLine}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className={cn('space-y-2', isMobile ? 'p-2' : 'p-2.5')}>
                      <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 p-2 dark:border-amber-500/30 dark:bg-amber-950/50">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                          <span className="flex size-5 items-center justify-center rounded-md bg-amber-200/80 text-amber-900 dark:bg-amber-400/25 dark:text-amber-100">
                            <Palette className="size-3" aria-hidden />
                          </span>
                          Tema
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleAppTheme('light')}
                            className={cn(
                              'flex min-h-[34px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold transition-all active:scale-[0.98] sm:min-h-11 sm:gap-1 sm:px-2 sm:py-1.5 sm:text-[10px]',
                              currentAppTheme === 'light'
                                ? 'bg-amber-100 text-amber-950 shadow-sm ring-2 ring-amber-400/80 dark:bg-amber-400/25 dark:text-amber-50 dark:ring-amber-300/60'
                                : 'bg-background text-muted-foreground hover:bg-amber-100/60 hover:text-foreground dark:bg-zinc-900 dark:hover:bg-amber-950/40',
                            )}
                            title="Açık tema"
                          >
                            <Sun className="size-3.5 sm:size-4" aria-hidden />
                            Açık
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleAppTheme('dark')}
                            className={cn(
                              'flex min-h-[34px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold transition-all active:scale-[0.98] sm:min-h-11 sm:gap-1 sm:px-2 sm:py-1.5 sm:text-[10px]',
                              currentAppTheme === 'dark'
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/70 dark:bg-indigo-500'
                                : 'bg-background text-muted-foreground hover:bg-indigo-500/15 hover:text-foreground dark:bg-zinc-900',
                            )}
                            title="Koyu tema"
                          >
                            <Moon className="size-3.5 sm:size-4" aria-hidden />
                            Koyu
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleAppTheme('system')}
                            className={cn(
                              'flex min-h-[34px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold transition-all active:scale-[0.98] sm:min-h-11 sm:gap-1 sm:px-2 sm:py-1.5 sm:text-[10px]',
                              currentAppTheme === 'system'
                                ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-400/70'
                                : 'bg-background text-muted-foreground hover:bg-sky-500/15 hover:text-foreground dark:bg-zinc-900',
                            )}
                            title="Sistem teması"
                          >
                            <Monitor className="size-3.5 sm:size-4" aria-hidden />
                            Sistem
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-2 dark:border-emerald-500/30 dark:bg-emerald-950/45">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          <span className="flex size-5 items-center justify-center rounded-md bg-emerald-200/80 text-emerald-900 dark:bg-emerald-400/25 dark:text-emerald-100">
                            <PanelLeft className="size-3" aria-hidden />
                          </span>
                          Kenar çubuğu
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setSidebarTheme('light')}
                            className={cn(
                              'flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] sm:min-h-11 sm:gap-2 sm:text-sm',
                              currentSidebarTheme === 'light'
                                ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300/70'
                                : 'bg-background text-muted-foreground hover:bg-emerald-100/70 hover:text-foreground dark:bg-zinc-900 dark:hover:bg-emerald-950/35',
                            )}
                            title="Açık kenar çubuğu"
                          >
                            <Sun className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                            Açık
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setSidebarTheme('dark')}
                            className={cn(
                              'flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] sm:min-h-11 sm:gap-2 sm:text-sm',
                              currentSidebarTheme === 'dark'
                                ? 'bg-zinc-800 text-white shadow-sm ring-2 ring-zinc-500/60 dark:bg-zinc-700'
                                : 'bg-background text-muted-foreground hover:bg-zinc-200/80 hover:text-foreground dark:bg-zinc-900 dark:hover:bg-zinc-800/60',
                            )}
                            title="Koyu kenar çubuğu"
                          >
                            <Moon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                            Koyu
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5 border-t border-border bg-muted/80 p-1.5 dark:bg-zinc-900/90">
                      <Link
                        href="/profile"
                        role="menuitem"
                        className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background active:scale-[0.99] sm:min-h-11 sm:text-sm"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200">
                          <User className="size-3.5" aria-hidden />
                        </span>
                        Profil
                      </Link>
                      {me?.role === 'moderator' && (
                        <Link
                          href="/contact-inbox"
                          role="menuitem"
                          className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background active:scale-[0.99] sm:min-h-11 sm:text-sm"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:bg-sky-500/25 dark:text-sky-100">
                            <Inbox className="size-3.5" aria-hidden />
                          </span>
                          İletişim gelen kutusu
                        </Link>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 active:scale-[0.99] dark:text-red-400 sm:min-h-11 sm:text-sm"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                          router.refresh();
                        }}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:bg-red-500/25 dark:text-red-300">
                          <LogOut className="size-3.5" aria-hidden />
                        </span>
                        Çıkış
                      </button>
                    </div>
                  </div>
                </>,
                document.body,
              )}
          </div>
        </div>
      </Container>
    </header>
  );
}
