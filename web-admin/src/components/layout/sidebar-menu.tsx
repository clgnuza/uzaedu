'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MENU_SIDEBAR } from '@/config/menu';
import type { MenuItem, WebAdminRole } from '@/config/types';
import { useAuth } from '@/hooks/use-auth';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';

interface SidebarMenuProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
}

type MenuGroupKey = NonNullable<MenuItem['menuGroup']>;
const DEFAULT_MENU_GROUP: MenuGroupKey = 'slate';

const G: Record<MenuGroupKey, { box: string; rail: string; active: string; hover: string; icon: string }> = {
  slate: {
    box: 'rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-500/[0.06] to-background p-2 dark:border-slate-600/40 dark:from-slate-950/50',
    rail: 'border-slate-200/80 dark:border-slate-600/35',
    active: 'bg-slate-600/15 text-slate-950 dark:bg-slate-500/22 dark:text-slate-50',
    hover: 'hover:bg-slate-500/10 dark:hover:bg-slate-950/40',
    icon: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/22 dark:text-slate-200',
  },
  amber: {
    box: 'rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/[0.07] to-background p-2 dark:border-amber-500/30 dark:from-amber-950/45',
    rail: 'border-amber-200/80 dark:border-amber-600/35',
    active: 'bg-amber-600/15 text-amber-950 dark:bg-amber-500/22 dark:text-amber-50',
    hover: 'hover:bg-amber-500/10 dark:hover:bg-amber-950/40',
    icon: 'bg-amber-500/18 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100',
  },
  rose: {
    box: 'rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-500/[0.07] to-background p-2 dark:border-rose-500/30 dark:from-rose-950/45',
    rail: 'border-rose-200/80 dark:border-rose-600/35',
    active: 'bg-rose-600/15 text-rose-950 dark:bg-rose-500/22 dark:text-rose-50',
    hover: 'hover:bg-rose-500/10 dark:hover:bg-rose-950/40',
    icon: 'bg-rose-500/18 text-rose-800 dark:bg-rose-500/25 dark:text-rose-100',
  },
  teal: {
    box: 'rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-500/[0.07] to-background p-2 dark:border-teal-500/30 dark:from-teal-950/45',
    rail: 'border-teal-200/80 dark:border-teal-600/35',
    active: 'bg-teal-600/15 text-teal-950 dark:bg-teal-500/22 dark:text-teal-50',
    hover: 'hover:bg-teal-500/10 dark:hover:bg-teal-950/40',
    icon: 'bg-teal-500/18 text-teal-800 dark:bg-teal-500/25 dark:text-teal-100',
  },
  orange: {
    box: 'rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-500/[0.07] to-background p-2 dark:border-orange-500/30 dark:from-orange-950/45',
    rail: 'border-orange-200/80 dark:border-orange-600/35',
    active: 'bg-orange-600/15 text-orange-950 dark:bg-orange-500/22 dark:text-orange-50',
    hover: 'hover:bg-orange-500/10 dark:hover:bg-orange-950/40',
    icon: 'bg-orange-500/18 text-orange-800 dark:bg-orange-500/25 dark:text-orange-100',
  },
  emerald: {
    box: 'rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/[0.07] to-background p-2 dark:border-emerald-500/30 dark:from-emerald-950/45',
    rail: 'border-emerald-200/80 dark:border-emerald-600/35',
    active: 'bg-emerald-600/15 text-emerald-950 dark:bg-emerald-500/22 dark:text-emerald-50',
    hover: 'hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40',
    icon: 'bg-emerald-500/18 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-100',
  },
  cyan: {
    box: 'rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-500/[0.07] to-background p-2 dark:border-cyan-500/30 dark:from-cyan-950/45',
    rail: 'border-cyan-200/80 dark:border-cyan-600/35',
    active: 'bg-cyan-600/15 text-cyan-950 dark:bg-cyan-500/22 dark:text-cyan-50',
    hover: 'hover:bg-cyan-500/10 dark:hover:bg-cyan-950/40',
    icon: 'bg-cyan-500/18 text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-100',
  },
  sky: {
    box: 'rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-500/[0.07] to-background p-2 dark:border-sky-500/30 dark:from-sky-950/45',
    rail: 'border-sky-200/80 dark:border-sky-600/35',
    active: 'bg-sky-600/15 text-sky-950 dark:bg-sky-500/20 dark:text-sky-50',
    hover: 'hover:bg-sky-500/10 dark:hover:bg-sky-950/40',
    icon: 'bg-sky-500/18 text-sky-700 dark:bg-sky-500/25 dark:text-sky-200',
  },
  violet: {
    box: 'rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-500/[0.08] to-background p-2 dark:border-violet-500/35 dark:from-violet-950/50',
    rail: 'border-violet-200/80 dark:border-violet-600/40',
    active: 'bg-violet-600/15 text-violet-950 dark:bg-violet-500/25 dark:text-white',
    hover: 'hover:bg-violet-500/10 dark:hover:bg-violet-950/45',
    icon: 'bg-violet-500/18 text-violet-800 dark:bg-violet-500/28 dark:text-violet-100',
  },
  zinc: {
    box: 'rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-500/[0.06] to-background p-2 dark:border-zinc-600/40 dark:from-zinc-950/50',
    rail: 'border-zinc-200/80 dark:border-zinc-600/35',
    active: 'bg-zinc-600/15 text-zinc-950 dark:bg-zinc-500/22 dark:text-zinc-50',
    hover: 'hover:bg-zinc-500/10 dark:hover:bg-zinc-950/40',
    icon: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/22 dark:text-zinc-200',
  },
  indigo: {
    box: 'rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-500/[0.08] to-background p-2 dark:border-indigo-500/35 dark:from-indigo-950/50',
    rail: 'border-indigo-200/80 dark:border-indigo-600/40',
    active: 'bg-indigo-600/15 text-indigo-950 dark:bg-indigo-500/25 dark:text-indigo-50',
    hover: 'hover:bg-indigo-500/10 dark:hover:bg-indigo-950/45',
    icon: 'bg-indigo-500/18 text-indigo-800 dark:bg-indigo-500/26 dark:text-indigo-100',
  },
  fuchsia: {
    box: 'rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-500/[0.07] to-background p-2 dark:border-fuchsia-500/30 dark:from-fuchsia-950/45',
    rail: 'border-fuchsia-200/80 dark:border-fuchsia-600/35',
    active: 'bg-fuchsia-600/15 text-fuchsia-950 dark:bg-fuchsia-500/22 dark:text-fuchsia-50',
    hover: 'hover:bg-fuchsia-500/10 dark:hover:bg-fuchsia-950/40',
    icon: 'bg-fuchsia-500/18 text-fuchsia-800 dark:bg-fuchsia-500/25 dark:text-fuchsia-100',
  },
};

function filterMenuTree(
  items: MenuItem[],
  role: WebAdminRole | null,
  moderatorModules?: string[] | null,
  schoolEnabledModules?: string[] | null,
  supportEnabled = true,
): MenuItem[] {
  if (!role) return [];
  const out: MenuItem[] = [];
  for (const item of items) {
    if (item.heading) {
      if (item.allowedRoles && !item.allowedRoles.includes(role)) continue;
      out.push(item);
      continue;
    }
    if (item.children?.length) {
      const kids = filterMenuTree(item.children, role, moderatorModules, schoolEnabledModules, supportEnabled);
      if (kids.length === 0) continue;
      if (!item.allowedRoles.includes(role)) continue;
      if (role === 'moderator' && item.requiredModule) {
        if (!moderatorModules?.includes(item.requiredModule)) continue;
      }
      if ((role === 'teacher' || role === 'school_admin') && item.requiredSchoolModule) {
        if (schoolEnabledModules?.length && !schoolEnabledModules.includes(item.requiredSchoolModule)) continue;
      }
      out.push({ ...item, children: kids });
      continue;
    }
    if (!item.allowedRoles.includes(role)) continue;
    if (!supportEnabled && role !== 'superadmin' && item.path?.startsWith('/support')) continue;
    if (role === 'moderator' && item.requiredModule) {
      if (!moderatorModules?.includes(item.requiredModule)) continue;
    }
    if ((role === 'teacher' || role === 'school_admin') && item.requiredSchoolModule) {
      if (schoolEnabledModules?.length && !schoolEnabledModules.includes(item.requiredSchoolModule)) continue;
    }
    out.push(item);
  }
  return out;
}

function label(item: MenuItem, role: WebAdminRole | null, bilsemOkul?: boolean): string {
  if (item.path === '/classes-subjects' && bilsemOkul) return 'Gruplar ve Dersler';
  return (role && item.titleByRole?.[role]) ?? item.title ?? '';
}

export function SidebarMenu({ role, moderatorModules }: SidebarMenuProps) {
  const pathname = usePathname();
  const { me } = useAuth();
  const { supportEnabled } = useSupportModuleAvailability();
  const supportEnabledValue = supportEnabled ?? true;
  const items = filterMenuTree(
    MENU_SIDEBAR,
    role,
    moderatorModules ?? me?.moderator_modules ?? null,
    me?.school?.enabled_modules ?? null,
    supportEnabledValue,
  );
  const bilsemOkul = me?.school?.enabled_modules?.includes('bilsem');

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
    <nav className="flex flex-col gap-1.5 px-3 py-5">
      {items.map((item, idx) => {
        if (item.heading) {
          return (
            <div key={`h-${idx}`} className="px-1 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75 first:pt-0">
              {item.heading}
            </div>
          );
        }
        if (item.children?.length) {
          const v = item.menuGroup ?? DEFAULT_MENU_GROUP;
          const s = G[v];
          const childOn = item.children?.some((c) => c.path && isActive(c.path)) ?? false;
          return (
            <div key={`b-${idx}`} className={cn('space-y-1.5', s.box)}>
              <div
                className={cn(
                  'flex items-center gap-2 px-1.5',
                  childOn ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.icon && (
                  <span className={cn('flex size-8 items-center justify-center rounded-lg', s.icon)}>
                    <item.icon className="size-4" aria-hidden />
                  </span>
                )}
                <span className="text-[13px] font-semibold leading-tight">{label(item, role, bilsemOkul)}</span>
              </div>
              <div className={cn('ml-2 space-y-0.5 border-l-2 pl-2.5', s.rail)}>
                {item.children.map((child) => {
                  if (!child.path) return null;
                  const active = isActive(child.path);
                  const t = label(child, role, bilsemOkul);
                  return (
                    <Link
                      key={child.path}
                      href={child.path}
                      className={cn(
                        'flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                        active ? s.active : cn('text-muted-foreground', s.hover),
                      )}
                    >
                      {child.icon && <child.icon className="size-4 shrink-0 opacity-90" />}
                      <span>{t}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }
        if (!item.path) return null;
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              'flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            {item.icon && <item.icon className="size-[18px] shrink-0" />}
            <span>{label(item, role, bilsemOkul)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
