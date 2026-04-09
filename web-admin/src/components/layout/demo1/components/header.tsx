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
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
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
                className="!w-[min(78vw,188px)] !max-w-[188px] gap-0 border-r p-0"
              >
                <SheetBody className="overflow-y-auto p-0">
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
            className="min-w-0 max-w-[min(100%,180px)] shrink-0 rounded-xl px-1.5 py-1 transition-opacity hover:opacity-90 sm:max-w-[min(100%,220px)] lg:hidden"
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
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  className={cn(
                    'absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(85dvh,36rem)] max-sm:max-h-[min(72dvh,28rem)] origin-top-right overflow-y-auto overscroll-contain rounded-3xl max-sm:rounded-2xl',
                    'w-[min(calc(100vw-1rem),22rem)] max-sm:fixed max-sm:left-2 max-sm:right-2 max-sm:top-[calc(var(--header-height,3.5rem)+0.35rem)] max-sm:w-auto',
                    'border border-white/20 bg-gradient-to-b from-card via-card to-muted/40 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5 backdrop-blur-xl',
                    'dark:border-white/10 dark:from-slate-900/98 dark:via-slate-950/95 dark:to-slate-950 dark:shadow-[0_24px_60px_-8px_rgba(0,0,0,0.55)] dark:ring-white/10',
                  )}
                  role="menu"
                >
                  <div className="relative overflow-hidden rounded-t-3xl max-sm:rounded-t-2xl border-b border-violet-500/15 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-cyan-500/12 px-4 py-4 max-sm:px-3 max-sm:py-3 dark:from-violet-500/20 dark:via-fuchsia-500/15 dark:to-cyan-500/18">
                    <div
                      className="pointer-events-none absolute -right-8 -top-10 size-32 max-sm:size-24 rounded-full bg-cyan-400/20 blur-2xl dark:bg-cyan-400/25"
                      aria-hidden
                    />
                    <div className="relative flex gap-2.5 max-sm:gap-2">
                      <UserAvatarBubble
                        avatarKey={me?.avatar_key}
                        avatarUrl={me?.avatar_url}
                        displayName={displayLabel}
                        email={me?.email}
                        size="md"
                        className="max-sm:scale-95 rounded-2xl! ring-2! ring-white/40 shadow-lg dark:ring-violet-400/30"
                        verified={schoolVerified}
                      />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-base max-sm:text-sm font-semibold leading-tight text-foreground">{displayLabel}</p>
                        {showEmailSub ? (
                          <p className="mt-0.5 max-sm:mt-0 truncate text-xs max-sm:text-[11px] leading-relaxed text-muted-foreground">{emailLine}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-sm:space-y-2 p-3 max-sm:p-2 sm:p-3.5">
                    <div className="rounded-2xl max-sm:rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-500/12 via-orange-500/8 to-rose-500/10 p-3 max-sm:p-2 shadow-inner dark:border-amber-500/20 dark:from-amber-400/15 dark:via-orange-500/10 dark:to-rose-500/15">
                      <div className="mb-2.5 max-sm:mb-1.5 flex items-center gap-2 text-[11px] max-sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200/95">
                        <span className="flex size-7 max-sm:size-6 items-center justify-center rounded-lg bg-amber-500/25 text-amber-700 dark:bg-amber-400/20 dark:text-amber-100">
                          <Palette className="size-3.5 max-sm:size-3" aria-hidden />
                        </span>
                        Tema
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 max-sm:gap-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('light')}
                          className={cn(
                            'flex min-h-[48px] max-sm:min-h-[40px] flex-col items-center justify-center gap-1 max-sm:gap-0.5 rounded-xl px-2 py-2.5 max-sm:py-1.5 text-[11px] max-sm:text-[10px] font-semibold transition-all active:scale-[0.98]',
                            currentAppTheme === 'light'
                              ? 'bg-gradient-to-b from-amber-100 to-amber-50 text-amber-950 shadow-md ring-2 ring-amber-400/70 dark:from-amber-400/30 dark:to-amber-500/20 dark:text-amber-50 dark:ring-amber-300/50'
                              : 'bg-background/70 text-muted-foreground hover:bg-amber-500/15 hover:text-foreground dark:bg-slate-900/60',
                          )}
                          title="Açık tema"
                        >
                          <Sun className="size-4 max-sm:size-3.5" aria-hidden />
                          Açık
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('dark')}
                          className={cn(
                            'flex min-h-[48px] max-sm:min-h-[40px] flex-col items-center justify-center gap-1 max-sm:gap-0.5 rounded-xl px-2 py-2.5 max-sm:py-1.5 text-[11px] max-sm:text-[10px] font-semibold transition-all active:scale-[0.98]',
                            currentAppTheme === 'dark'
                              ? 'bg-gradient-to-b from-indigo-600 to-violet-700 text-white shadow-md ring-2 ring-indigo-400/60 dark:from-indigo-500 dark:to-violet-600'
                              : 'bg-background/70 text-muted-foreground hover:bg-indigo-500/15 hover:text-foreground dark:bg-slate-900/60',
                          )}
                          title="Koyu tema"
                        >
                          <Moon className="size-4 max-sm:size-3.5" aria-hidden />
                          Koyu
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleAppTheme('system')}
                          className={cn(
                            'flex min-h-[48px] max-sm:min-h-[40px] flex-col items-center justify-center gap-1 max-sm:gap-0.5 rounded-xl px-2 py-2.5 max-sm:py-1.5 text-[11px] max-sm:text-[10px] font-semibold transition-all active:scale-[0.98]',
                            currentAppTheme === 'system'
                              ? 'bg-gradient-to-b from-sky-500 to-cyan-600 text-white shadow-md ring-2 ring-sky-300/60'
                              : 'bg-background/70 text-muted-foreground hover:bg-sky-500/15 hover:text-foreground dark:bg-slate-900/60',
                          )}
                          title="Sistem teması"
                        >
                          <Monitor className="size-4 max-sm:size-3.5" aria-hidden />
                          Sistem
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl max-sm:rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-500/10 via-teal-500/8 to-cyan-500/10 p-3 max-sm:p-2 shadow-inner dark:border-emerald-500/25 dark:from-emerald-500/15 dark:via-teal-500/10 dark:to-cyan-500/12">
                      <div className="mb-2.5 max-sm:mb-1.5 flex items-center gap-2 text-[11px] max-sm:text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200/95">
                        <span className="flex size-7 max-sm:size-6 items-center justify-center rounded-lg bg-emerald-500/25 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100">
                          <PanelLeft className="size-3.5 max-sm:size-3" aria-hidden />
                        </span>
                        Kenar çubuğu
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-sm:gap-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setSidebarTheme('light')}
                          className={cn(
                            'flex min-h-[48px] max-sm:min-h-[40px] items-center justify-center gap-2 max-sm:gap-1.5 rounded-xl px-3 max-sm:px-2 py-3 max-sm:py-2 text-sm max-sm:text-xs font-semibold transition-all active:scale-[0.98]',
                            currentSidebarTheme === 'light'
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-md ring-2 ring-emerald-300/50'
                              : 'bg-background/70 text-muted-foreground hover:bg-emerald-500/12 hover:text-foreground dark:bg-slate-900/60',
                          )}
                          title="Açık kenar çubuğu"
                        >
                          <Sun className="size-4 max-sm:size-3.5 shrink-0" aria-hidden />
                          Açık
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setSidebarTheme('dark')}
                          className={cn(
                            'flex min-h-[48px] max-sm:min-h-[40px] items-center justify-center gap-2 max-sm:gap-1.5 rounded-xl px-3 max-sm:px-2 py-3 max-sm:py-2 text-sm max-sm:text-xs font-semibold transition-all active:scale-[0.98]',
                            currentSidebarTheme === 'dark'
                              ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-md ring-2 ring-slate-500/50 dark:from-slate-600 dark:to-slate-800'
                              : 'bg-background/70 text-muted-foreground hover:bg-slate-500/20 hover:text-foreground dark:bg-slate-900/60',
                          )}
                          title="Koyu kenar çubuğu"
                        >
                          <Moon className="size-4 max-sm:size-3.5 shrink-0" aria-hidden />
                          Koyu
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-border/60 bg-muted/20 p-2 max-sm:p-1.5 dark:bg-slate-900/40">
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="flex min-h-[48px] max-sm:min-h-[42px] items-center gap-2.5 max-sm:gap-2 rounded-2xl max-sm:rounded-xl px-3 max-sm:px-2.5 py-3 max-sm:py-2 text-sm max-sm:text-[13px] font-semibold text-foreground transition-colors hover:bg-gradient-to-r hover:from-violet-500/15 hover:to-cyan-500/10 active:scale-[0.99] dark:hover:from-violet-500/25 dark:hover:to-cyan-500/15"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span className="flex size-10 max-sm:size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-700 dark:from-violet-500/30 dark:to-cyan-500/25 dark:text-violet-200">
                        <User className="size-4 max-sm:size-3.5" aria-hidden />
                      </span>
                      Profil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex min-h-[48px] max-sm:min-h-[42px] w-full items-center gap-2.5 max-sm:gap-2 rounded-2xl max-sm:rounded-xl px-3 max-sm:px-2.5 py-3 max-sm:py-2 text-left text-sm max-sm:text-[13px] font-semibold text-red-600 transition-colors hover:bg-gradient-to-r hover:from-red-500/15 hover:to-rose-500/10 active:scale-[0.99] dark:text-red-400 dark:hover:from-red-500/20 dark:hover:to-rose-500/15"
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                        router.refresh();
                      }}
                    >
                      <span className="flex size-10 max-sm:size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/15 text-red-600 dark:from-red-500/30 dark:to-rose-500/20 dark:text-red-300">
                        <LogOut className="size-4 max-sm:size-3.5" aria-hidden />
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
