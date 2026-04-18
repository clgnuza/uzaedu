'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  FolderKanban,
  Settings2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type TabTheme = {
  /** Aktif sekme: alt çizgi + metin */
  active: string;
  /** Aktif: ikon kutusu */
  iconActive: string;
  /** Pasif: ikon kutusu */
  iconIdle: string;
  /** Pasif: metin */
  labelIdle: string;
};

type NavItem = {
  path: string;
  label: string;
  labelAdmin?: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Kısa açıklama (öğretmen) */
  hint: string;
  /** Okul yöneticisi ipucu */
  hintAdmin?: string;
  theme: TabTheme;
};

const NAV_ITEMS: NavItem[] = [
  {
    path: '/ders-programi',
    label: 'Haftalık tablo',
    labelAdmin: 'Okul Programı',
    hint: 'Haftalık ızgara; içeride kişisel veya okul seçimi',
    hintAdmin: 'Tüm öğretmenlerin haftalık planı',
    icon: CalendarDays,
    theme: {
      active: 'border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-100',
      iconActive: 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-600/20 dark:ring-sky-300/25',
      iconIdle: 'bg-sky-100/90 text-sky-600 dark:bg-sky-950/55 dark:text-sky-300',
      labelIdle: 'text-sky-900/75 dark:text-sky-200/80',
    },
  },
  {
    path: '/ders-programi/olustur',
    label: 'Program Oluştur',
    labelAdmin: 'Excel ile Yükle',
    hint: 'Yeni program veya Excel içe aktarma',
    hintAdmin: 'XLSX ile toplu program yükleme',
    icon: FileSpreadsheet,
    theme: {
      active: 'border-emerald-500 text-emerald-800 dark:border-emerald-400 dark:text-emerald-100',
      iconActive: 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600/20 dark:ring-emerald-300/25',
      iconIdle: 'bg-emerald-100/90 text-emerald-600 dark:bg-emerald-950/55 dark:text-emerald-300',
      labelIdle: 'text-emerald-900/75 dark:text-emerald-200/80',
    },
  },
  {
    path: '/ders-programi/programlarim',
    label: 'Programlarım',
    labelAdmin: 'Öğretmen programları',
    hint: 'Tüm kişisel programlar (liste)',
    hintAdmin: 'Öğretmenlere göre planlar',
    icon: FolderKanban,
    theme: {
      active: 'border-violet-500 text-violet-800 dark:border-violet-400 dark:text-violet-100',
      iconActive: 'bg-violet-500 text-white shadow-sm ring-1 ring-violet-600/20 dark:ring-violet-300/25',
      iconIdle: 'bg-violet-100/90 text-violet-600 dark:bg-violet-950/55 dark:text-violet-300',
      labelIdle: 'text-violet-900/75 dark:text-violet-200/80',
    },
  },
  {
    path: '/ders-programi/ayarlar',
    label: 'Ayarlar',
    labelAdmin: 'Ders Saatleri',
    hint: 'Zaman çizelgesi ve kurallar',
    hintAdmin: 'Ders süreleri ve dönem ayarları',
    icon: Settings2,
    adminOnly: true,
    theme: {
      active: 'border-amber-500 text-amber-900 dark:border-amber-400 dark:text-amber-50',
      iconActive: 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-600/25 dark:ring-amber-300/25',
      iconIdle: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
      labelIdle: 'text-amber-950/80 dark:text-amber-200/85',
    },
  },
];

export function DersProgramiNav() {
  const pathname = usePathname();
  const { me } = useAuth();
  const isAdmin = me?.role === 'school_admin';

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (p: string) =>
    p === '/ders-programi' ? pathname === '/ders-programi' : pathname === p || pathname.startsWith(p + '/');

  const activeItem = visibleItems.find((i) => isActive(i.path));

  return (
    <div className="mb-2 print:hidden sm:mb-4">
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-br from-sky-500/[0.08] via-background to-violet-500/[0.06] px-2.5 py-2 shadow-sm ring-1 ring-sky-500/10 dark:border-border dark:from-sky-950/35 dark:to-violet-950/20 dark:ring-sky-900/25 sm:rounded-2xl sm:px-4 sm:py-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-sky-400/10 blur-2xl dark:bg-sky-500/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-6 size-28 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/12"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 shadow-inner ring-1 ring-sky-500/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25 sm:size-10 sm:rounded-xl">
              <CalendarDays className="size-4 sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-bold leading-tight tracking-tight text-foreground sm:text-base">
                {isAdmin ? 'Okul Ders Programı' : 'Ders programı'}
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {isAdmin ? 'Excel, programlar, ders saatleri' : 'Haftalık tablo ve işlemler'}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:px-2.5 sm:py-1 sm:text-[10px]',
              isAdmin
                ? 'border-amber-300/80 bg-amber-100/90 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200',
            )}
          >
            {isAdmin ? 'Yönetici' : 'Öğretmen'}
          </span>
        </div>
      </div>

      {isAdmin ? (
        <nav
          className="mt-1.5 rounded-lg border border-border/50 bg-muted/25 p-0.5 shadow-inner dark:bg-muted/15 sm:mt-3 sm:rounded-xl sm:p-1.5"
          aria-label="Ders programı bölümleri"
        >
          <ul className="flex snap-x snap-mandatory gap-0.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] scrollbar-none sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:pb-0">
            {visibleItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              const label = item.labelAdmin ? item.labelAdmin : item.label;
              const hint = item.hintAdmin ? item.hintAdmin : item.hint;
              const t = item.theme;
              return (
                <li key={item.path} className="min-w-[calc(50%-2px)] shrink-0 snap-start sm:min-w-0 sm:flex-1 sm:snap-none">
                  <Link
                    href={item.path}
                    title={hint}
                    className={cn(
                      'flex h-full min-h-[40px] items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition-all sm:min-h-0 sm:gap-2.5 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-[13px]',
                      active
                        ? cn('bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10', t.active)
                        : cn('text-muted-foreground hover:bg-background/70 hover:text-foreground', t.labelIdle),
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md transition-all sm:size-8 sm:rounded-lg',
                        active ? t.iconActive : cn(t.iconIdle, 'opacity-90'),
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4 sm:size-[18px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0 sm:gap-0.5">
                      <span className="line-clamp-2 leading-tight">{label}</span>
                      <span className="hidden truncate text-[10px] font-normal leading-none text-muted-foreground sm:block sm:max-w-36">
                        {hint}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {isAdmin ? (
        <nav
          className="mt-2 hidden flex-wrap items-center gap-0.5 text-[11px] text-muted-foreground sm:flex"
          aria-label="Breadcrumb"
        >
          <Link href="/dashboard" className="rounded px-0.5 hover:text-foreground">
            Anasayfa
          </Link>
          <ChevronRight className="size-3 shrink-0 opacity-40" aria-hidden />
          <Link
            href="/ders-programi"
            className={cn(
              'rounded px-0.5 hover:text-foreground',
              activeItem?.path === '/ders-programi' ? 'font-medium text-foreground' : '',
            )}
          >
            Okul Programı
          </Link>
          {activeItem && activeItem.path !== '/ders-programi' && (
            <>
              <ChevronRight className="size-3 shrink-0 opacity-40" aria-hidden />
              <Link href={activeItem.path} className="font-medium text-foreground">
                {activeItem.labelAdmin ? activeItem.labelAdmin : activeItem.label}
              </Link>
            </>
          )}
        </nav>
      ) : null}
    </div>
  );
}
