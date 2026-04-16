'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import {
  LayoutGrid,
  Building2,
  Search,
  Settings,
  GraduationCap,
  CalendarRange,
  BookUser,
  CalendarDays,
} from 'lucide-react';

const TABS = [
  {
    path: '/kelebek-sinav',
    label: 'Anasayfa',
    shortLabel: 'Ana',
    icon: LayoutGrid,
    adminOnly: false,
    match: (pathname: string) => pathname === '/kelebek-sinav',
    activeClass: 'from-indigo-600 to-violet-600 shadow-indigo-500/35 ring-indigo-400/35',
    idleClass: 'text-indigo-950/90 hover:bg-indigo-500/12 dark:text-indigo-100/90 dark:hover:bg-indigo-950/45',
  },
  {
    path: '/kelebek-sinav/ogrenci-sorgu',
    label: 'Öğrenci sorgulama',
    shortLabel: 'Sorgu',
    icon: Search,
    adminOnly: false,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/ogrenci-sorgu'),
    activeClass: 'from-sky-600 to-cyan-600 shadow-sky-500/30 ring-sky-400/30',
    idleClass: 'text-sky-950/90 hover:bg-sky-500/12 dark:text-sky-100/90 dark:hover:bg-sky-950/40',
  },
  {
    path: '/kelebek-sinav/sinif-ogrenci',
    label: 'Sınıf - Öğrenci İşlemleri',
    shortLabel: 'Sınıf',
    icon: BookUser,
    adminOnly: true,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/sinif-ogrenci'),
    activeClass: 'from-sky-600 to-cyan-600 shadow-sky-500/30 ring-sky-400/30',
    idleClass: 'text-sky-950/90 hover:bg-sky-500/12 dark:text-sky-100/90 dark:hover:bg-sky-950/40',
  },
  {
    path: '/kelebek-sinav/yerlesim',
    label: 'Salon İşlemleri',
    shortLabel: 'Salon',
    icon: Building2,
    adminOnly: true,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/yerlesim'),
    activeClass: 'from-amber-600 to-orange-600 shadow-amber-500/25 ring-amber-400/25',
    idleClass: 'text-amber-950/90 hover:bg-amber-500/12 dark:text-amber-100/90 dark:hover:bg-amber-950/40',
  },
  {
    path: '/kelebek-sinav/ders-ogretmen',
    label: 'Ders - Öğretmen İşlemleri',
    shortLabel: 'Ders',
    icon: GraduationCap,
    adminOnly: true,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/ders-ogretmen'),
    activeClass: 'from-violet-600 to-fuchsia-600 shadow-violet-500/25 ring-violet-400/25',
    idleClass: 'text-violet-950/90 hover:bg-violet-500/12 dark:text-violet-100/90 dark:hover:bg-violet-950/45',
  },
  {
    path: '/kelebek-sinav/sinav-planlama',
    label: 'Sınav Takvimi',
    shortLabel: 'Takvim',
    icon: CalendarDays,
    adminOnly: false,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/sinav-planlama'),
    activeClass: 'from-teal-600 to-emerald-600 shadow-teal-500/25 ring-teal-400/25',
    idleClass: 'text-teal-950/90 hover:bg-teal-500/12 dark:text-teal-100/90 dark:hover:bg-teal-950/45',
  },
  {
    path: '/kelebek-sinav/sinav-islemleri',
    label: 'Sınav İşlemleri',
    shortLabel: 'Sınav',
    icon: CalendarRange,
    adminOnly: false,
    match: (pathname: string) =>
      pathname.startsWith('/kelebek-sinav/sinav-islemleri') ||
      pathname.startsWith('/kelebek-sinav/sinav-olustur') ||
      pathname.startsWith('/kelebek-sinav/oturumlar'),
    activeClass: 'from-fuchsia-600 to-pink-600 shadow-fuchsia-500/30 ring-fuchsia-400/25',
    idleClass: 'text-fuchsia-950/90 hover:bg-fuchsia-500/12 dark:text-fuchsia-100/90 dark:hover:bg-fuchsia-950/45',
  },
  {
    path: '/kelebek-sinav/ayarlar',
    label: 'İçe Aktar / PDF',
    shortLabel: 'Aktar',
    icon: Settings,
    adminOnly: true,
    match: (pathname: string) => pathname.startsWith('/kelebek-sinav/ayarlar'),
    activeClass: 'from-emerald-600 to-teal-600 shadow-emerald-500/25 ring-emerald-400/25',
    idleClass: 'text-emerald-950/90 hover:bg-emerald-500/12 dark:text-emerald-100/90 dark:hover:bg-emerald-950/45',
  },
] as const;

export default function KelebekSinavLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const canSalon =
    me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';
  const schoolQ = butterflyExamApiQuery(me?.role, searchParams.get('school_id'));
  const baseTabs = TABS.filter((t) => !t.adminOnly || canSalon);
  const teacherTabPaths = ['/kelebek-sinav/ogrenci-sorgu', '/kelebek-sinav/sinav-islemleri'] as const;
  const visibleTabs =
    me?.role === 'teacher'
      ? baseTabs.filter((t) => teacherTabPaths.includes(t.path as (typeof teacherTabPaths)[number]))
      : baseTabs;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-3 px-0 sm:space-y-6 sm:px-0">
      <div className="overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-500/[0.12] via-fuchsia-500/[0.06] to-amber-400/[0.08] p-2.5 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/55 dark:via-fuchsia-950/25 dark:to-amber-950/15 sm:p-4">
        <div className="mb-2 flex flex-col gap-2.5 sm:mb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-indigo-950 dark:text-indigo-50 sm:text-lg md:text-xl">
              Kertenkele Sınav Modülü
            </h1>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-sm">
              Sınıf ve salon yönetimi; sınav oturumu, yerleştirme ve raporlar.
            </p>
          </div>
          <Link
            href={`/kelebek-sinav/ogrenci-sorgu${schoolQ}`}
            className={cn(
              'inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-900 shadow-sm backdrop-blur-sm sm:w-auto',
              'hover:bg-white/90 dark:border-indigo-500/25 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/60',
            )}
          >
            <Search className="size-4 shrink-0" />
            Öğrenci sorgu
          </Link>
        </div>
        <nav
          className="-mx-0.5 flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain px-0.5 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:overscroll-auto sm:px-0 sm:pb-0.5 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Kertenkele sınav bölümleri"
        >
          {visibleTabs.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            const href = `${tab.path}${schoolQ}`;
            return (
              <Link
                key={tab.path}
                href={href}
                role="tab"
                aria-selected={active}
                className={cn(
                  'flex min-w-[5.25rem] shrink-0 snap-center items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[10px] font-semibold leading-tight transition-all duration-200 sm:min-w-0 sm:flex-1 sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm md:py-3',
                  active
                    ? cn(
                        'bg-gradient-to-r text-white shadow-md ring-1 ring-offset-1 ring-offset-background sm:shadow-lg sm:ring-2 sm:ring-offset-2 dark:ring-offset-zinc-950',
                        tab.activeClass,
                      )
                    : cn('border border-transparent bg-white/55 text-muted-foreground dark:bg-zinc-900/45', tab.idleClass),
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-95 sm:size-4 md:size-[1.1rem]" strokeWidth={2} />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden leading-tight sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
