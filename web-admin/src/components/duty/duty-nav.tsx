'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  CalendarDays,
  ArrowLeftRight,
  SlidersHorizontal,
  Users,
  UserMinus,
  BarChart2,
  Settings2,
  ScrollText,
  ChevronDown,
  AlertTriangle,
  FileSignature,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';

const PENDING_COVERAGE_INTERVAL_MS = 60_000;
const PENDING_COVERAGE_BACKOFF_MS = 180_000; // Bağlantı hatasında 3 dk bekle

type NavItem = {
  path: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Sadece öğretmen (okul yöneticisi bu sekmeyi görmez) */
  teacherOnly?: boolean;
  /** Gruplama: 'main' | 'admin' */
  group?: 'main' | 'admin';
  /** Öğretmen için: swap_enabled veya preferences_enabled ile sınırlı (admin her zaman görür) */
  teacherFeatureKey?: 'swap' | 'preferences';
};

const NAV_ITEMS: NavItem[] = [
  // Ana sekmeler
  { path: '/duty', label: 'Takvim', icon: LayoutDashboard, group: 'main' },
  { path: '/duty/planlar', label: 'Nöbet Planları', shortLabel: 'Planlar', icon: CalendarRange, group: 'main' },
  { path: '/duty/gunluk-tablo', label: 'Günlük Liste', icon: ClipboardList, group: 'main' },
  { path: '/duty/aylik-liste', label: 'Aylık Liste', shortLabel: 'Aylık', icon: CalendarDays, group: 'main', teacherOnly: true },
  { path: '/duty/takas', label: 'Görev Devri', icon: ArrowLeftRight, group: 'main', teacherFeatureKey: 'swap' },
  { path: '/duty/tercihler', label: 'Tercihlerim', icon: SlidersHorizontal, group: 'main', teacherFeatureKey: 'preferences' },
  // Yönetim sekmeleri (admin)
  { path: '/duty/gorevlendirilen', label: 'Görevlendirmeler', icon: Users, adminOnly: true, group: 'admin' },
  { path: '/duty/gelmeyen', label: 'Devamsızlık', icon: UserMinus, adminOnly: true, group: 'admin' },
  { path: '/duty/ozet', label: 'İstatistikler', icon: BarChart2, adminOnly: true, group: 'admin' },
  { path: '/duty/teblig', label: 'Tebliğ', icon: FileSignature, adminOnly: true, group: 'admin' },
  { path: '/duty/yerler', label: 'Ayarlar', icon: Settings2, adminOnly: true, group: 'admin' },
  { path: '/duty/logs', label: 'İşlem Kaydı', icon: ScrollText, adminOnly: true, group: 'admin' },
];

/** Sekme başına hafif pastel (ikon + hover + aktif ring); mobilde de aynı sınıflar */
type TabPastel = {
  icon: string;
  iconActive: string;
  idleHover: string;
  activeExtra: string;
  dot: string;
  menuHover: string;
  menuActive: string;
};

const TAB_PASTEL: Record<string, TabPastel> = {
  '/duty': {
    icon: 'bg-sky-500/12 text-sky-700 dark:bg-sky-500/14 dark:text-sky-300',
    iconActive: 'bg-sky-500/22 text-sky-800 shadow-sm dark:bg-sky-500/30 dark:text-sky-100',
    idleHover: 'hover:bg-sky-500/[0.07] dark:hover:bg-sky-500/10',
    activeExtra: 'ring-1 ring-sky-400/35 dark:ring-sky-400/25',
    dot: 'bg-sky-500/65',
    menuHover: 'hover:bg-sky-500/10 dark:hover:bg-sky-500/15',
    menuActive: 'bg-sky-500/12 text-sky-800 dark:bg-sky-500/18 dark:text-sky-100',
  },
  '/duty/planlar': {
    icon: 'bg-indigo-500/12 text-indigo-700 dark:bg-indigo-500/14 dark:text-indigo-300',
    iconActive: 'bg-indigo-500/22 text-indigo-800 shadow-sm dark:bg-indigo-500/30 dark:text-indigo-100',
    idleHover: 'hover:bg-indigo-500/[0.07] dark:hover:bg-indigo-500/10',
    activeExtra: 'ring-1 ring-indigo-400/35 dark:ring-indigo-400/25',
    dot: 'bg-indigo-500/65',
    menuHover: 'hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15',
    menuActive: 'bg-indigo-500/12 text-indigo-800 dark:bg-indigo-500/18 dark:text-indigo-100',
  },
  '/duty/gunluk-tablo': {
    icon: 'bg-cyan-500/12 text-cyan-800 dark:bg-cyan-500/14 dark:text-cyan-300',
    iconActive: 'bg-cyan-500/22 text-cyan-900 shadow-sm dark:bg-cyan-500/30 dark:text-cyan-100',
    idleHover: 'hover:bg-cyan-500/[0.07] dark:hover:bg-cyan-500/10',
    activeExtra: 'ring-1 ring-cyan-400/35 dark:ring-cyan-400/25',
    dot: 'bg-cyan-500/65',
    menuHover: 'hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15',
    menuActive: 'bg-cyan-500/12 text-cyan-900 dark:bg-cyan-500/18 dark:text-cyan-100',
  },
  '/duty/aylik-liste': {
    icon: 'bg-fuchsia-500/12 text-fuchsia-800 dark:bg-fuchsia-500/14 dark:text-fuchsia-300',
    iconActive: 'bg-fuchsia-500/22 text-fuchsia-900 shadow-sm dark:bg-fuchsia-500/30 dark:text-fuchsia-100',
    idleHover: 'hover:bg-fuchsia-500/[0.07] dark:hover:bg-fuchsia-500/10',
    activeExtra: 'ring-1 ring-fuchsia-400/35 dark:ring-fuchsia-400/25',
    dot: 'bg-fuchsia-500/65',
    menuHover: 'hover:bg-fuchsia-500/10 dark:hover:bg-fuchsia-500/15',
    menuActive: 'bg-fuchsia-500/12 text-fuchsia-900 dark:bg-fuchsia-500/18 dark:text-fuchsia-100',
  },
  '/duty/takas': {
    icon: 'bg-amber-500/14 text-amber-800 dark:bg-amber-500/14 dark:text-amber-300',
    iconActive: 'bg-amber-500/24 text-amber-900 shadow-sm dark:bg-amber-500/30 dark:text-amber-100',
    idleHover: 'hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/10',
    activeExtra: 'ring-1 ring-amber-400/40 dark:ring-amber-400/25',
    dot: 'bg-amber-500/65',
    menuHover: 'hover:bg-amber-500/10 dark:hover:bg-amber-500/15',
    menuActive: 'bg-amber-500/12 text-amber-900 dark:bg-amber-500/18 dark:text-amber-100',
  },
  '/duty/tercihler': {
    icon: 'bg-rose-500/12 text-rose-700 dark:bg-rose-500/14 dark:text-rose-300',
    iconActive: 'bg-rose-500/22 text-rose-800 shadow-sm dark:bg-rose-500/30 dark:text-rose-100',
    idleHover: 'hover:bg-rose-500/[0.07] dark:hover:bg-rose-500/10',
    activeExtra: 'ring-1 ring-rose-400/35 dark:ring-rose-400/25',
    dot: 'bg-rose-500/65',
    menuHover: 'hover:bg-rose-500/10 dark:hover:bg-rose-500/15',
    menuActive: 'bg-rose-500/12 text-rose-800 dark:bg-rose-500/18 dark:text-rose-100',
  },
  '/duty/gorevlendirilen': {
    icon: 'bg-violet-500/12 text-violet-700 dark:bg-violet-500/14 dark:text-violet-300',
    iconActive: 'bg-violet-500/22 text-violet-800 shadow-sm dark:bg-violet-500/30 dark:text-violet-100',
    idleHover: 'hover:bg-violet-500/[0.07] dark:hover:bg-violet-500/10',
    activeExtra: 'ring-1 ring-violet-400/35 dark:ring-violet-400/25',
    dot: 'bg-violet-500/65',
    menuHover: 'hover:bg-violet-500/10 dark:hover:bg-violet-500/15',
    menuActive: 'bg-violet-500/12 text-violet-800 dark:bg-violet-500/18 dark:text-violet-100',
  },
  '/duty/gelmeyen': {
    icon: 'bg-orange-500/12 text-orange-800 dark:bg-orange-500/14 dark:text-orange-300',
    iconActive: 'bg-orange-500/22 text-orange-900 shadow-sm dark:bg-orange-500/30 dark:text-orange-100',
    idleHover: 'hover:bg-orange-500/[0.07] dark:hover:bg-orange-500/10',
    activeExtra: 'ring-1 ring-orange-400/35 dark:ring-orange-400/25',
    dot: 'bg-orange-500/65',
    menuHover: 'hover:bg-orange-500/10 dark:hover:bg-orange-500/15',
    menuActive: 'bg-orange-500/12 text-orange-900 dark:bg-orange-500/18 dark:text-orange-100',
  },
  '/duty/ozet': {
    icon: 'bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/14 dark:text-emerald-300',
    iconActive: 'bg-emerald-500/22 text-emerald-900 shadow-sm dark:bg-emerald-500/30 dark:text-emerald-100',
    idleHover: 'hover:bg-emerald-500/[0.07] dark:hover:bg-emerald-500/10',
    activeExtra: 'ring-1 ring-emerald-400/35 dark:ring-emerald-400/25',
    dot: 'bg-emerald-500/65',
    menuHover: 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
    menuActive: 'bg-emerald-500/12 text-emerald-900 dark:bg-emerald-500/18 dark:text-emerald-100',
  },
  '/duty/teblig': {
    icon: 'bg-teal-500/12 text-teal-800 dark:bg-teal-500/14 dark:text-teal-300',
    iconActive: 'bg-teal-500/22 text-teal-900 shadow-sm dark:bg-teal-500/30 dark:text-teal-100',
    idleHover: 'hover:bg-teal-500/[0.07] dark:hover:bg-teal-500/10',
    activeExtra: 'ring-1 ring-teal-400/35 dark:ring-teal-400/25',
    dot: 'bg-teal-500/65',
    menuHover: 'hover:bg-teal-500/10 dark:hover:bg-teal-500/15',
    menuActive: 'bg-teal-500/12 text-teal-900 dark:bg-teal-500/18 dark:text-teal-100',
  },
  '/duty/yerler': {
    icon: 'bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300',
    iconActive: 'bg-slate-500/22 text-slate-800 shadow-sm dark:bg-slate-500/32 dark:text-slate-100',
    idleHover: 'hover:bg-slate-500/[0.08] dark:hover:bg-slate-500/12',
    activeExtra: 'ring-1 ring-slate-400/35 dark:ring-slate-500/30',
    dot: 'bg-slate-500/60',
    menuHover: 'hover:bg-slate-500/10 dark:hover:bg-slate-500/15',
    menuActive: 'bg-slate-500/12 text-slate-800 dark:bg-slate-500/20 dark:text-slate-100',
  },
  '/duty/logs': {
    icon: 'bg-stone-500/12 text-stone-700 dark:bg-stone-500/16 dark:text-stone-300',
    iconActive: 'bg-stone-500/22 text-stone-800 shadow-sm dark:bg-stone-500/30 dark:text-stone-100',
    idleHover: 'hover:bg-stone-500/[0.08] dark:hover:bg-stone-500/12',
    activeExtra: 'ring-1 ring-stone-400/35 dark:ring-stone-500/28',
    dot: 'bg-stone-500/60',
    menuHover: 'hover:bg-stone-500/10 dark:hover:bg-stone-500/15',
    menuActive: 'bg-stone-500/12 text-stone-800 dark:bg-stone-500/18 dark:text-stone-100',
  },
};

const PASTEL_FALLBACK: TabPastel = {
  icon: 'bg-muted/50 text-muted-foreground group-hover/tab:bg-muted group-hover/tab:text-foreground dark:bg-muted/30',
  iconActive: 'bg-primary/12 text-primary',
  idleHover: '',
  activeExtra: '',
  dot: 'bg-primary/50',
  menuHover: 'hover:bg-muted/80 hover:text-foreground',
  menuActive: 'bg-primary/10 text-primary dark:bg-primary/15',
};

function tabPastelFor(path: string): TabPastel {
  return TAB_PASTEL[path] ?? PASTEL_FALLBACK;
}

export function DutyNav() {
  const pathname = usePathname();
  const { me, token } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [teacherFeatures, setTeacherFeatures] = useState<{ swap_enabled: boolean; preferences_enabled: boolean } | null>(null);
  const [pendingCoverageCount, setPendingCoverageCount] = useState(0);

  const fetchTeacherFeatures = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ swap_enabled: boolean; preferences_enabled: boolean }>('/duty/teacher-features', { token });
      setTeacherFeatures(data);
    } catch {
      setTeacherFeatures({ swap_enabled: true, preferences_enabled: true });
    }
  }, [token]);

  useEffect(() => {
    fetchTeacherFeatures();
  }, [fetchTeacherFeatures]);

  const fetchPendingCoverageCount = useCallback(async (): Promise<boolean> => {
    if (!token || !isAdmin) return false;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const to = new Date();
      to.setDate(to.getDate() + 60);
      const toStr = to.toISOString().slice(0, 10);
      const data = await apiFetch<{ count: number }>(`/duty/pending-coverage-count?from=${today}&to=${toStr}`, { token });
      setPendingCoverageCount(data?.count ?? 0);
      return true;
    } catch {
      setPendingCoverageCount(0);
      return false;
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        fetchPendingCoverageCount().then((ok) => {
          if (cancelled) return;
          scheduleNext(ok ? PENDING_COVERAGE_INTERVAL_MS : PENDING_COVERAGE_BACKOFF_MS);
        });
      }, delayMs);
    };

    const onUpdate = () => {
      if (cancelled) return;
      fetchPendingCoverageCount().then((ok) => {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        scheduleNext(ok ? PENDING_COVERAGE_INTERVAL_MS : PENDING_COVERAGE_BACKOFF_MS);
      });
    };

    fetchPendingCoverageCount().then((ok) => {
      if (cancelled) return;
      scheduleNext(ok ? PENDING_COVERAGE_INTERVAL_MS : PENDING_COVERAGE_BACKOFF_MS);
    });
    window.addEventListener('duty-pending-coverage-update', onUpdate);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('duty-pending-coverage-update', onUpdate);
    };
  }, [fetchPendingCoverageCount, token, isAdmin]);

  const isItemVisible = (item: NavItem): boolean => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.teacherOnly && isAdmin) return false;
    if (isAdmin) return true;
    if (item.teacherFeatureKey && teacherFeatures) {
      if (item.teacherFeatureKey === 'swap') return teacherFeatures.swap_enabled;
      if (item.teacherFeatureKey === 'preferences') return teacherFeatures.preferences_enabled;
    }
    return true;
  };

  const mainItems = NAV_ITEMS.filter((i) => i.group === 'main' && isItemVisible(i));
  const adminItems = NAV_ITEMS.filter((i) => i.group === 'admin' && (!i.adminOnly || isAdmin));

  const allVisible = [...mainItems, ...adminItems];
  const isActive = (p: string) => p === '/duty' ? pathname === '/duty' : pathname === p || pathname.startsWith(p + '/');
  const activeItem = allVisible.find((i) => isActive(i.path));

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeGroup = activeItem?.group;

  const tabBase =
    'group/tab inline-flex min-h-[34px] shrink-0 snap-start items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium whitespace-nowrap select-none transition-colors sm:min-h-8 sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs active:scale-[0.99]';
  const tabInactive = 'text-muted-foreground';
  const tabActive =
    'bg-background text-foreground shadow-[0_2px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-border/70 dark:bg-card dark:shadow-[0_2px_16px_-4px_rgba(0,0,0,0.45)] dark:ring-border/60';
  const iconWrap =
    'flex size-6 shrink-0 items-center justify-center rounded transition-colors sm:size-7 sm:rounded-md';
  const managementPastel = TAB_PASTEL['/duty/gorevlendirilen']!;

  return (
    <div className="mb-2 print:hidden sm:mb-3">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground sm:size-9">
            <CalendarRange className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-foreground sm:text-base">Nöbet yönetimi</h2>
            <p className="hidden text-[10px] text-muted-foreground sm:block sm:text-[11px]">MEB Madde 91 uyumlu</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide sm:px-3 sm:py-1 sm:text-xs',
            isAdmin
              ? 'bg-primary/10 text-primary ring-1 ring-primary/20 dark:bg-primary/15 dark:ring-primary/30'
              : 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
          )}
        >
          {isAdmin ? 'Yönetici' : 'Öğretmen'}
        </span>
      </div>

      <div className="relative">
        <div className="-mx-1 touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] sm:snap-none sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <div
            className={cn(
              'inline-flex w-max min-w-full flex-nowrap items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5 sm:gap-1 sm:p-1',
              'sm:inline-flex sm:w-auto sm:min-w-0 sm:flex-wrap',
            )}
          >
            <nav
              className="flex flex-nowrap items-center gap-1 sm:flex-wrap"
              aria-label="Nöbet modülü sekmeleri"
            >
              {mainItems.map((item) => {
                const active =
                  item.path === '/duty'
                    ? pathname === '/duty'
                    : pathname === item.path || pathname.startsWith(item.path + '/');
                const p = tabPastelFor(item.path);
                const Icon = item.icon;
                const showWarning =
                  isAdmin &&
                  pendingCoverageCount > 0 &&
                  (item.path === '/duty' || item.path === '/duty/gunluk-tablo');
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(tabBase, active ? cn(tabActive, p.activeExtra) : cn(tabInactive, p.idleHover))}
                  >
                    <span className="relative inline-flex">
                      <span className={cn(iconWrap, active ? p.iconActive : p.icon)}>
                        <Icon className="size-3.5 sm:size-4" aria-hidden />
                      </span>
                      {showWarning && (
                        <span
                          className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-md ring-2 ring-background dark:ring-card"
                          title={`${pendingCoverageCount} devamsız slot için ayarlama bekliyor`}
                        >
                          <AlertTriangle className="size-2.5" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="max-w-38 truncate sm:max-w-none">{item.shortLabel ?? item.label}</span>
                  </Link>
                );
              })}

              {isAdmin && adminItems.length > 0 && (
                <>
                  <div
                    className="mx-0.5 hidden h-8 w-px shrink-0 self-center bg-linear-to-b from-transparent via-border to-transparent sm:block"
                    aria-hidden
                  />

                  {adminItems.map((item) => {
                    const active = pathname === item.path || pathname.startsWith(item.path + '/');
                    const p = tabPastelFor(item.path);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          tabBase,
                          'hidden sm:inline-flex',
                          active ? cn(tabActive, p.activeExtra) : cn(tabInactive, p.idleHover),
                        )}
                      >
                        <span className={cn(iconWrap, active ? p.iconActive : p.icon)}>
                          <Icon className="size-3.5 sm:size-4" aria-hidden />
                        </span>
                        <span className="max-w-40 truncate">{item.shortLabel ?? item.label}</span>
                      </Link>
                    );
                  })}

                  <div ref={moreRef} className="relative shrink-0 sm:hidden">
                    <button
                      type="button"
                      onClick={() => setMoreOpen((o) => !o)}
                      className={cn(
                        'group/tab',
                        tabBase,
                        'w-full min-w-44 justify-between sm:min-w-0',
                        activeGroup === 'admin'
                          ? cn(tabActive, managementPastel.activeExtra)
                          : cn(tabInactive, managementPastel.idleHover),
                      )}
                      aria-expanded={moreOpen}
                      aria-haspopup="menu"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            iconWrap,
                            activeGroup === 'admin' ? managementPastel.iconActive : managementPastel.icon,
                          )}
                        >
                          <Settings2 className="size-4" aria-hidden />
                        </span>
                        Yönetim
                      </span>
                      <ChevronDown className={cn('size-3.5 shrink-0 opacity-60 transition-transform', moreOpen && 'rotate-180')} />
                    </button>
                    {moreOpen && (
                      <div
                        className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[min(100vw-2rem,240px)] overflow-hidden rounded-2xl border border-border/50 bg-popover/95 py-1.5 shadow-xl backdrop-blur-md dark:bg-popover"
                        role="menu"
                      >
                        {adminItems.map((item) => {
                          const active = pathname === item.path || pathname.startsWith(item.path + '/');
                          const p = tabPastelFor(item.path);
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              role="menuitem"
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                'mx-1 flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                active
                                  ? cn(p.menuActive, 'font-semibold')
                                  : cn('text-muted-foreground', p.menuHover, 'hover:text-foreground'),
                              )}
                            >
                              <span className={cn(iconWrap, active ? p.iconActive : p.icon)}>
                                <Icon className="size-3.5 sm:size-4" aria-hidden />
                              </span>
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>

      {activeItem && (
        <p className="mt-1.5 hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex sm:text-[11px]">
          <span className={cn('inline-flex h-1 w-1 rounded-full', tabPastelFor(activeItem.path).dot)} aria-hidden />
          <span className="text-muted-foreground/80">{activeItem.label}</span>
        </p>
      )}
    </div>
  );
}
