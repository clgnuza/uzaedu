'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Calendar, Settings, ClipboardList } from 'lucide-react';

const TABS = [
  { path: '/bilsem/takvim', label: 'Takvim', icon: Calendar, title: 'Haftalık takvim ve etkinlikler', adminOnly: false },
  { path: '/bilsem/takvim/ayarlar', label: 'Ayarlar', icon: Settings, adminOnly: true, title: 'Hafta ayarları ve görevlendirmeler' },
  {
    path: '/bilsem/takvim/yillik-plan',
    label: 'BİLSEM yıllık çalışma planı',
    icon: ClipboardList,
    title: 'BİLSEM yıllık çalışma planı',
    adminOnly: false,
  },
] as const;

export default function BilsemTakvimLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const isSchoolAdmin = me?.role === 'school_admin';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isSchoolAdmin);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200/50 bg-gradient-to-r from-violet-50/80 to-purple-50/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-violet-900/30 dark:from-violet-950/40 dark:to-purple-950/40">
        <nav className="flex flex-wrap items-center gap-1" role="tablist">
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
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                    : 'text-muted-foreground hover:bg-white/60 hover:text-foreground dark:hover:bg-violet-900/30',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
