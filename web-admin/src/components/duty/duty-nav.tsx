'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  ArrowLeftRight,
  SlidersHorizontal,
  Users,
  UserMinus,
  BarChart2,
  Settings2,
  ScrollText,
  Tv2,
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
  { path: '/duty/takas', label: 'Görev Devri', icon: ArrowLeftRight, group: 'main', teacherFeatureKey: 'swap' },
  { path: '/duty/tercihler', label: 'Tercihlerim', icon: SlidersHorizontal, group: 'main', teacherFeatureKey: 'preferences' },
  // Yönetim sekmeleri (admin)
  { path: '/duty/gorevlendirilen', label: 'Görevlendirmeler', icon: Users, adminOnly: true, group: 'admin' },
  { path: '/duty/gelmeyen', label: 'Devamsızlık', icon: UserMinus, adminOnly: true, group: 'admin' },
  { path: '/duty/ozet', label: 'İstatistikler', icon: BarChart2, adminOnly: true, group: 'admin' },
  { path: '/duty/teblig', label: 'Tebliğ', icon: FileSignature, adminOnly: true, group: 'admin' },
  { path: '/duty/yerler', label: 'Ayarlar', icon: Settings2, adminOnly: true, group: 'admin' },
  { path: '/duty/logs', label: 'İşlem Kaydı', icon: ScrollText, adminOnly: true, group: 'admin' },
  { path: '/tv', label: 'TV Ekranı', icon: Tv2, adminOnly: true, group: 'admin' },
];

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

  return (
    <div className="mb-6 print:hidden">
      {/* Başlık + Modül etiketi */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary">
            <CalendarRange className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-foreground">Nöbet Yönetimi</h2>
            <p className="text-xs text-muted-foreground leading-tight">MEB Madde 91 uyumlu</p>
          </div>
        </div>
        {/* Rol rozeti */}
        <span className={cn(
          'hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
          isAdmin
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
        )}>
          {isAdmin ? 'Yönetici' : 'Öğretmen'}
        </span>
      </div>

      {/* Navigasyon */}
      <div className="relative">
        {/* Arka plan şeridi */}
        <div className="flex flex-col gap-2 sm:gap-0">
          {/* Ana sekmeler */}
          <div className="overflow-x-auto scrollbar-none">
            <nav
              className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 w-fit min-w-full"
              aria-label="Nöbet modülü ana sekmeler"
            >
              {mainItems.map((item) => {
                const active = item.path === '/duty'
                  ? pathname === '/duty'
                  : pathname === item.path || pathname.startsWith(item.path + '/');
                const Icon = item.icon;
                const showWarning = isAdmin && pendingCoverageCount > 0 && (item.path === '/duty' || item.path === '/duty/gunluk-tablo');
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap select-none relative',
                      active
                        ? 'bg-white dark:bg-card shadow-sm text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-card/60',
                    )}
                  >
                    <span className="relative inline-flex">
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {showWarning && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white"
                          title={`${pendingCoverageCount} devamsız slot için ayarlama bekliyor`}
                        >
                          <AlertTriangle className="size-2.5" />
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:inline">{item.shortLabel ?? item.label}</span>
                    <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
                  </Link>
                );
              })}

              {/* Admin sekmeler — daha büyük ekranda satır içi, mobilde "Yönetim" dropdown */}
              {isAdmin && adminItems.length > 0 && (
                <>
                  {/* Ayırıcı */}
                  <div className="mx-1 h-5 w-px bg-border/60 shrink-0 hidden sm:block" />

                  {/* Admin sekmeleri – sm ve üstü */}
                  {adminItems.map((item) => {
                    const active = pathname === item.path || pathname.startsWith(item.path + '/');
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          'hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap select-none',
                          active
                            ? 'bg-white dark:bg-card shadow-sm text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-card/60',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.shortLabel ?? item.label}
                      </Link>
                    );
                  })}

                  {/* Admin sekmeleri – mobil dropdown */}
                  <div ref={moreRef} className="relative sm:hidden ml-1">
                    <button
                      onClick={() => setMoreOpen((o) => !o)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap select-none',
                        activeGroup === 'admin'
                          ? 'bg-white dark:bg-card shadow-sm text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/60',
                      )}
                    >
                      <Settings2 className="size-4 shrink-0" />
                      Yönetim
                      <ChevronDown className={cn('size-3 transition-transform', moreOpen && 'rotate-180')} />
                    </button>
                    {moreOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-xl bg-popover border border-border shadow-lg py-1">
                        {adminItems.map((item) => {
                          const active = pathname === item.path || pathname.startsWith(item.path + '/');
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                                active ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                              )}
                            >
                              <Icon className="size-4 shrink-0" />
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

        {/* Aktif sekme alt çizgisi */}
        <div className="mt-2 h-px bg-border/40" />
      </div>

      {/* Aktif sayfa breadcrumb */}
      {activeItem && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Nöbet</span>
          <span>/</span>
          <span className="text-foreground font-medium">{activeItem.label}</span>
        </div>
      )}
    </div>
  );
}
