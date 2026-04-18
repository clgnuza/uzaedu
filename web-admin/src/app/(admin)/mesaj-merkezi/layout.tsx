'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { msgQ } from '@/lib/messaging-api';
import {
  LayoutGrid,
  Users,
  Banknote,
  FileText,
  BookOpen,
  LogOut,
  Settings,
  MessageSquare,
  CalendarCheck,
  PartyPopper,
  ClipboardList,
  GraduationCap,
  Mail,
  ChevronDown,
} from 'lucide-react';

const GROUPS = [
  {
    label: 'Genel',
    tabs: [
      { path: '/mesaj-merkezi',               label: 'Genel Bakış',      icon: LayoutGrid,    adminOnly: false, active: (p: string) => p === '/mesaj-merkezi',                          cls: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',  idle: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' },
      { path: '/mesaj-merkezi/ogretmen-ayarlar', label: 'Ayarlarım',     icon: Settings,      adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/ogretmen-ayarlar'), cls: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',   idle: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
      { path: '/mesaj-merkezi/veli-iletisim', label: 'Toplu Mesaj',      icon: MessageSquare, adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/veli-iletisim'),  cls: 'from-sky-500 to-cyan-600 shadow-sky-500/25',          idle: 'hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
      { path: '/mesaj-merkezi/gruplar',       label: 'Gruplar',          icon: Users,         adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/gruplar'),        cls: 'from-violet-500 to-purple-600 shadow-violet-500/25',  idle: 'hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-700 dark:text-violet-300' },
    ],
  },
  {
    label: 'Devamsızlık',
    tabs: [
      { path: '/mesaj-merkezi/devamsizlik',         label: 'Günlük',         icon: LogOut,        adminOnly: false, active: (p: string) => p === '/mesaj-merkezi/devamsizlik',              cls: 'from-rose-500 to-pink-600 shadow-rose-500/25',        idle: 'hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
      { path: '/mesaj-merkezi/ders-devamsizlik',    label: 'Ders',           icon: BookOpen,      adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/ders-devamsizlik'), cls: 'from-red-500 to-rose-600 shadow-red-500/25',          idle: 'hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300' },
      { path: '/mesaj-merkezi/devamsizlik-mektup',  label: 'Mektup',         icon: Mail,          adminOnly: true,  active: (p: string) => p.startsWith('/mesaj-merkezi/devamsizlik-mektup'), cls: 'from-orange-500 to-red-600 shadow-orange-500/20',  idle: 'hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
      { path: '/mesaj-merkezi/izin',                label: 'İzin',           icon: LogOut,        adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/izin'),            cls: 'from-lime-500 to-green-600 shadow-lime-500/20',       idle: 'hover:bg-lime-50 dark:hover:bg-lime-950/40 text-lime-700 dark:text-lime-300' },
    ],
  },
  {
    label: 'Karne',
    tabs: [
      { path: '/mesaj-merkezi/ara-karne', label: 'Ara Karne', icon: GraduationCap, adminOnly: true, active: (p: string) => p.startsWith('/mesaj-merkezi/ara-karne'), cls: 'from-teal-500 to-emerald-600 shadow-teal-500/20',    idle: 'hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300' },
      { path: '/mesaj-merkezi/karne',     label: 'Karne',     icon: BookOpen,      adminOnly: true, active: (p: string) => p === '/mesaj-merkezi/karne',           cls: 'from-emerald-500 to-green-600 shadow-emerald-500/20', idle: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
    ],
  },
  {
    label: 'Bordro',
    tabs: [
      { path: '/mesaj-merkezi/mebbis-puantaj', label: 'Puantaj',      icon: ClipboardList, adminOnly: true, active: (p: string) => p.startsWith('/mesaj-merkezi/mebbis-puantaj'), cls: 'from-slate-500 to-gray-600 shadow-slate-500/20',      idle: 'hover:bg-slate-50 dark:hover:bg-slate-950/40 text-slate-700 dark:text-slate-300' },
      { path: '/mesaj-merkezi/kbs-ek-ders',   label: 'KBS Ek Ders',  icon: FileText,      adminOnly: true, active: (p: string) => p.startsWith('/mesaj-merkezi/kbs-ek-ders'),    cls: 'from-orange-500 to-amber-600 shadow-orange-500/20',   idle: 'hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
      { path: '/mesaj-merkezi/kbs-maas',      label: 'KBS Maaş',     icon: Banknote,      adminOnly: true, active: (p: string) => p.startsWith('/mesaj-merkezi/kbs-maas'),       cls: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',  idle: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
      { path: '/mesaj-merkezi/ek-ders',       label: 'Ek Ders',      icon: FileText,      adminOnly: true, active: (p: string) => p.startsWith('/mesaj-merkezi/ek-ders'),         cls: 'from-amber-500 to-orange-600 shadow-amber-500/20',    idle: 'hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
      { path: '/mesaj-merkezi/maas',          label: 'Maaş',         icon: Banknote,      adminOnly: true, active: (p: string) => p === '/mesaj-merkezi/maas',                    cls: 'from-violet-500 to-fuchsia-600 shadow-violet-500/20', idle: 'hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-700 dark:text-violet-300' },
    ],
  },
  {
    label: 'Etkinlik',
    tabs: [
      { path: '/mesaj-merkezi/veli-toplantisi', label: 'Veli Toplantısı', icon: CalendarCheck, adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/veli-toplantisi'), cls: 'from-cyan-500 to-sky-600 shadow-cyan-500/20',    idle: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300' },
      { path: '/mesaj-merkezi/davetiye',        label: 'Davetiye',        icon: PartyPopper,   adminOnly: false, active: (p: string) => p.startsWith('/mesaj-merkezi/davetiye'),       cls: 'from-pink-500 to-rose-600 shadow-pink-500/20',   idle: 'hover:bg-pink-50 dark:hover:bg-pink-950/40 text-pink-700 dark:text-pink-300' },
      { path: '/mesaj-merkezi/ayarlar',         label: 'Ayarlar',         icon: Settings,      adminOnly: true,  active: (p: string) => p.startsWith('/mesaj-merkezi/ayarlar'),        cls: 'from-slate-500 to-zinc-600 shadow-slate-500/20', idle: 'hover:bg-slate-50 dark:hover:bg-slate-950/40 text-slate-600 dark:text-slate-300' },
    ],
  },
] as const;

type TabDef = (typeof GROUPS)[number]['tabs'][number];

function tabVisible(t: TabDef, isAdmin: boolean, isTeacher: boolean): boolean {
  if (!(!t.adminOnly || isAdmin)) return false;
  if (isTeacher) {
    return (
      t.path === '/mesaj-merkezi' ||
      t.path === '/mesaj-merkezi/ogretmen-ayarlar' ||
      t.path === '/mesaj-merkezi/veli-iletisim'
    );
  }
  if (t.path === '/mesaj-merkezi/ogretmen-ayarlar') return false;
  return true;
}

export default function MesajMerkeziLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const isAdmin = me?.role !== 'teacher';
  const isTeacher = me?.role === 'teacher';
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const currentTabLabel = useMemo(() => {
    for (const group of GROUPS) {
      for (const t of group.tabs) {
        if (!tabVisible(t, isAdmin, isTeacher)) continue;
        if (t.active(pathname)) return t.label;
      }
    }
    return 'Genel Bakış';
  }, [pathname, isAdmin, isTeacher]);

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-1 sm:space-y-4 sm:px-0">
      <div className="overflow-hidden rounded-xl border border-green-200/50 bg-linear-to-br from-green-500/8 via-teal-500/5 to-indigo-400/6 p-2 shadow-sm dark:border-green-900/40 dark:from-green-950/50 sm:rounded-2xl sm:p-3">
        <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold tracking-tight text-green-950 dark:text-green-50 sm:text-base">
              📲 Mesaj Gönderme Merkezi
            </h1>
            <p
              className={cn(
                'text-xs leading-snug text-muted-foreground sm:text-xs',
                !mobileNavOpen && 'max-md:line-clamp-1',
              )}
            >
              WhatsApp üzerinden veli, öğrenci ve öğretmenlere otomatik kişiselleştirilmiş mesaj gönderin.
            </p>
          </div>
          <button
            type="button"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((o) => !o)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200/70 bg-white/70 px-2 py-1.5 text-xs font-semibold text-green-900 shadow-sm dark:border-green-800/50 dark:bg-zinc-900/70 dark:text-green-100 md:hidden"
          >
            <span className="max-w-[140px] truncate">{currentTabLabel}</span>
            <ChevronDown className={cn('size-4 shrink-0 text-green-700 transition-transform dark:text-green-300', mobileNavOpen && 'rotate-180')} />
          </button>
        </div>

        <div className={cn('space-y-1.5', !mobileNavOpen && 'max-md:hidden', 'md:block')}>
          {GROUPS.map((group) => {
            const visibleTabs = group.tabs.filter((t) => tabVisible(t, isAdmin, isTeacher));
            if (!visibleTabs.length) return null;
            return (
              <div
                key={group.label}
                className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-stretch sm:gap-2"
              >
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 sm:w-[72px] sm:self-center sm:text-right sm:text-[10px] sm:tracking-wider">
                  {group.label}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:content-start sm:gap-1">
                  {visibleTabs.map((tab) => {
                    const active = tab.active(pathname);
                    const Icon = tab.icon;
                    return (
                      <Link
                        key={tab.path}
                        href={`${tab.path}${q}`}
                        className={cn(
                          'flex min-h-10 w-full items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold leading-snug transition-all duration-150 sm:min-h-9 sm:min-w-30 sm:flex-1 sm:justify-center sm:px-2 sm:py-1.5 sm:text-[11px] sm:leading-tight',
                          active
                            ? cn('bg-linear-to-r text-white shadow-md', tab.cls)
                            : cn('border border-transparent bg-white/65 dark:bg-zinc-900/55', tab.idle),
                        )}
                      >
                        <Icon className="size-4 shrink-0 sm:size-3.5" strokeWidth={2.2} />
                        <span className="min-w-0 text-left sm:truncate sm:text-center">{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
