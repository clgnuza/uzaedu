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
    label: 'Ders Programı',
    labelAdmin: 'Okul Programı',
    hint: 'Haftalık okul programı',
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
    labelAdmin: 'Öğretmen Programları',
    hint: 'Kişisel programlarınız',
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
    <div className="mb-4 print:hidden">
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-linear-to-br from-sky-500/6 via-background to-violet-500/5 px-3 py-2.5 sm:px-4">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-sky-400/10 blur-2xl dark:bg-sky-500/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-6 size-28 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/12"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 shadow-inner ring-1 ring-sky-500/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25">
              <CalendarDays className="size-[20px]" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base">
                {isAdmin ? 'Okul Ders Programı' : 'Ders Programı'}
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                {isAdmin ? 'Plan yükleme, öğretmen programları ve ders saatleri' : 'Haftalık plan ve kişisel programlar'}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
              isAdmin
                ? 'border-amber-300/80 bg-amber-100/90 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200',
            )}
          >
            {isAdmin ? 'Yönetici' : 'Öğretmen'}
          </span>
        </div>
      </div>

      <nav className="-mx-1 mt-3 flex overflow-x-auto scrollbar-none pb-0.5" aria-label="Ders programı sekmeleri">
        <ul className="flex min-w-0 flex-1 gap-1.5 border-b border-border/60 pb-px sm:gap-2">
          {visibleItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            const label = isAdmin && item.labelAdmin ? item.labelAdmin : item.label;
            const hint = isAdmin && item.hintAdmin ? item.hintAdmin : item.hint;
            const t = item.theme;
            return (
              <li key={item.path} className="shrink-0">
                <Link
                  href={item.path}
                  title={hint}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-t-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors sm:px-3.5',
                    active
                      ? cn('-mb-px border-b-2 bg-background/80', t.active)
                      : 'border-b-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg transition-all',
                      active ? t.iconActive : cn(t.iconIdle, 'group-hover:opacity-100'),
                    )}
                    aria-hidden
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className={cn('flex min-w-0 flex-col items-start gap-0', !active && t.labelIdle)}>
                    <span className="leading-tight">{label}</span>
                    <span
                      className={cn(
                        'hidden max-w-44 truncate text-[10px] font-normal leading-none sm:block',
                        active ? 'text-current/70' : 'text-muted-foreground group-hover:text-foreground/70',
                      )}
                    >
                      {hint}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="mt-2 flex flex-wrap items-center gap-0.5 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
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
          {isAdmin ? 'Okul Programı' : 'Ders Programı'}
        </Link>
        {activeItem && activeItem.path !== '/ders-programi' && (
          <>
            <ChevronRight className="size-3 shrink-0 opacity-40" aria-hidden />
            <Link href={activeItem.path} className="font-medium text-foreground">
              {isAdmin && activeItem.labelAdmin ? activeItem.labelAdmin : activeItem.label}
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
