'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Calendar, Settings, ClipboardList } from 'lucide-react';

const TABS = [
  {
    path: '/bilsem/takvim',
    label: 'Takvim',
    shortLabel: 'Takvim',
    icon: Calendar,
    title: 'Haftalık takvim ve etkinlikler',
    adminOnly: false,
    activeClass: 'from-sky-600 to-cyan-600 shadow-sky-500/30 ring-sky-400/30',
    idleClass: 'text-sky-900/85 hover:bg-sky-500/10 dark:text-sky-100/90 dark:hover:bg-sky-950/40',
  },
  {
    path: '/bilsem/takvim/ayarlar',
    label: 'Ayarlar',
    shortLabel: 'Ayar',
    icon: Settings,
    adminOnly: true,
    title: 'Hafta ayarları ve görevlendirmeler',
    activeClass: 'from-amber-600 to-orange-600 shadow-amber-500/25 ring-amber-400/30',
    idleClass: 'text-amber-950/90 hover:bg-amber-500/12 dark:text-amber-100/90 dark:hover:bg-amber-950/35',
  },
  {
    path: '/bilsem/takvim/yillik-plan',
    label: 'Yıllık çalışma planı',
    shortLabel: 'Yıllık plan',
    icon: ClipboardList,
    title: 'Bilsem yıllık çalışma planı',
    adminOnly: false,
    activeClass: 'from-violet-600 to-fuchsia-600 shadow-violet-500/30 ring-fuchsia-400/25',
    idleClass: 'text-violet-900/90 hover:bg-violet-500/10 dark:text-violet-100/90 dark:hover:bg-violet-950/45',
  },
] as const;

export default function BilsemTakvimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const isSchoolAdmin = me?.role === 'school_admin';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isSchoolAdmin);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="print:hidden rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50/90 via-white/80 to-fuchsia-50/70 p-2 shadow-sm dark:border-violet-900/35 dark:from-violet-950/50 dark:via-zinc-950/80 dark:to-fuchsia-950/40 sm:p-2.5">
        <nav
          className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Bilsem takvim bölümleri"
        >
          {visibleTabs.map((tab) => {
            const active = pathname === tab.path || (tab.path !== '/bilsem/takvim' && pathname.startsWith(tab.path));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tab.path}
                role="tab"
                aria-selected={active}
                title={tab.title}
                className={cn(
                  'flex min-w-[8.75rem] shrink-0 snap-start items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition-all duration-200 sm:min-w-0 sm:flex-1 sm:px-4 sm:py-3 sm:text-sm',
                  active
                    ? cn('bg-gradient-to-r text-white shadow-lg ring-2 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950', tab.activeClass)
                    : cn('border border-transparent bg-white/50 text-muted-foreground dark:bg-zinc-900/40', tab.idleClass),
                )}
              >
                <Icon className="size-4 shrink-0 opacity-95 sm:size-[1.15rem]" strokeWidth={2} />
                <span className="leading-tight sm:hidden">{tab.shortLabel}</span>
                <span className="hidden leading-tight sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
