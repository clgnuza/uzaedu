'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { msgQ } from '@/lib/messaging-api';
import { LayoutGrid, Users, Banknote, FileText, BookOpen, LogOut, Settings, MessageSquare, CalendarCheck, PartyPopper, ClipboardList, GraduationCap, Mail } from 'lucide-react';

const GROUPS = [
  {
    label: 'Genel',
    tabs: [
      { path: '/mesaj-merkezi',               label: 'Genel Bakış',      icon: LayoutGrid,    adminOnly: false, active: (p: string) => p === '/mesaj-merkezi',                          cls: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',  idle: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' },
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

export default function MesajMerkeziLayout({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { me }       = useAuth();
  const isAdmin      = me?.role !== 'teacher';
  const q            = msgQ(me?.role, searchParams.get('school_id'));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="overflow-hidden rounded-2xl border border-green-200/50 bg-linear-to-br from-green-500/8 via-teal-500/5 to-indigo-400/6 p-3 shadow-sm dark:border-green-900/40 dark:from-green-950/50 sm:p-4">
        <div className="mb-3">
          <h1 className="text-base font-bold tracking-tight text-green-950 dark:text-green-50 sm:text-lg">
            📲 Mesaj Gönderme Merkezi
          </h1>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            WhatsApp üzerinden veli, öğrenci ve öğretmenlere otomatik kişiselleştirilmiş mesaj gönderin.
          </p>
        </div>

        <div className="space-y-1.5">
          {GROUPS.map((group) => {
            const visibleTabs = group.tabs.filter((t) => !t.adminOnly || isAdmin);
            if (!visibleTabs.length) return null;
            return (
              <div key={group.label} className="flex items-stretch gap-2 min-w-0">
                {/* Grup etiketi — sabit genişlik */}
                <span className="w-[68px] shrink-0 self-center text-right text-[9px] font-bold uppercase tracking-widest text-muted-foreground/55">
                  {group.label}
                </span>
                {/* Sekmeler — eşit genişlik */}
                <div className="flex flex-1 gap-1 min-w-0"
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
                  {visibleTabs.map((tab) => {
                    const active = tab.active(pathname);
                    const Icon   = tab.icon;
                    return (
                      <Link key={tab.path} href={`${tab.path}${q}`}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[10.5px] font-semibold text-center leading-tight transition-all duration-150 whitespace-nowrap overflow-hidden',
                          active
                            ? cn('bg-linear-to-r text-white shadow-md', tab.cls)
                            : cn('bg-white/60 dark:bg-zinc-900/50 border border-transparent', tab.idle),
                        )}>
                        <Icon className="size-3 shrink-0" strokeWidth={2.2} />
                        <span className="truncate">{tab.label}</span>
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
