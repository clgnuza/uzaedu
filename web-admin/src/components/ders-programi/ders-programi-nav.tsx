'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, List, PlusCircle, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type NavItem = {
  path: string;
  label: string;
  labelAdmin?: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { path: '/ders-programi', label: 'Ders Programı', icon: BookOpen },
  { path: '/ders-programi/olustur', label: 'Program Oluştur', labelAdmin: 'Excel ile Yükle', icon: PlusCircle },
  { path: '/ders-programi/programlarim', label: 'Programlarım', icon: List },
  { path: '/ders-programi/ayarlar', label: 'Ayarlar', icon: Settings2, adminOnly: true },
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
    <div className="mb-6 print:hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-foreground">Ders Programı</h2>
            <p className="text-xs text-muted-foreground leading-tight">
              {isAdmin ? 'Okul programı yönetimi' : 'Haftalık ders programınız'}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
            isAdmin
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
          )}
        >
          {isAdmin ? 'Yönetici' : 'Öğretmen'}
        </span>
      </div>

      <div className="relative">
        <div className="overflow-x-auto scrollbar-none">
          <nav
            className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 w-fit min-w-full"
            aria-label="Ders programı sekmeleri"
          >
            {visibleItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              const label = isAdmin && item.labelAdmin ? item.labelAdmin : item.label;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap select-none border-b-2',
                    active
                      ? 'bg-white dark:bg-card shadow-sm text-primary border-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-card/60',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-2 h-px bg-border/40" />
      </div>

      <nav className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Anasayfa</Link>
        <span>/</span>
        <Link href="/ders-programi" className={cn(activeItem?.path === '/ders-programi' ? 'text-foreground font-medium' : 'hover:text-foreground transition-colors')}>
          Ders Programı
        </Link>
        {activeItem && activeItem.path !== '/ders-programi' && (
          <>
            <span>/</span>
            <Link href={activeItem.path} className="text-foreground font-medium">
              {isAdmin && activeItem.labelAdmin ? activeItem.labelAdmin : activeItem.label}
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
