'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MENU_SIDEBAR } from '@/config/menu';
import type { MenuItem, WebAdminRole } from '@/config/types';
import { useAuth } from '@/hooks/use-auth';
import { useAdminMessagesUnread } from '@/hooks/use-admin-messages-unread';
import { useAllNotificationsUnread } from '@/hooks/use-duty-notifications-unread';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';

interface SidebarMenuProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
  schoolEnabledModules?: string[] | null;
}

type MenuGroupKey = NonNullable<MenuItem['menuGroup']>;

const DEFAULT_MENU_GROUP: MenuGroupKey = 'slate';

const GROUP_SHELL: Record<
  MenuGroupKey,
  { wrap: string; iconWrap: string; rail: string; linkIdle: string; linkActive: string }
> = {
  slate: {
    wrap: 'rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-500/[0.06] via-background/95 to-zinc-500/[0.04] p-2 shadow-sm dark:border-slate-600/40 dark:from-slate-950/50 dark:to-zinc-950/20',
    iconWrap: 'bg-slate-500/15 text-slate-700 shadow-inner dark:bg-slate-500/22 dark:text-slate-200',
    rail: 'border-slate-200/80 dark:border-slate-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-slate-500/[0.08] hover:text-foreground dark:hover:bg-slate-950/40',
    linkActive:
      'bg-slate-600/12 font-semibold text-slate-900 shadow-sm dark:bg-slate-500/22 dark:text-slate-50',
  },
  amber: {
    wrap: 'rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/[0.07] via-background/95 to-orange-500/[0.05] p-2 shadow-sm dark:border-amber-500/30 dark:from-amber-950/45 dark:to-orange-950/20',
    iconWrap: 'bg-amber-500/18 text-amber-800 shadow-inner dark:bg-amber-500/25 dark:text-amber-100',
    rail: 'border-amber-200/80 dark:border-amber-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-amber-500/[0.08] hover:text-foreground dark:hover:bg-amber-950/40',
    linkActive:
      'bg-amber-600/12 font-semibold text-amber-950 shadow-sm dark:bg-amber-500/22 dark:text-amber-50',
  },
  rose: {
    wrap: 'rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-500/[0.07] via-background/95 to-pink-500/[0.05] p-2 shadow-sm dark:border-rose-500/30 dark:from-rose-950/45 dark:to-pink-950/20',
    iconWrap: 'bg-rose-500/18 text-rose-800 shadow-inner dark:bg-rose-500/25 dark:text-rose-100',
    rail: 'border-rose-200/80 dark:border-rose-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-rose-500/[0.08] hover:text-foreground dark:hover:bg-rose-950/40',
    linkActive:
      'bg-rose-600/12 font-semibold text-rose-950 shadow-sm dark:bg-rose-500/22 dark:text-rose-50',
  },
  teal: {
    wrap: 'rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-500/[0.07] via-background/95 to-cyan-500/[0.05] p-2 shadow-sm dark:border-teal-500/30 dark:from-teal-950/45 dark:to-cyan-950/20',
    iconWrap: 'bg-teal-500/18 text-teal-800 shadow-inner dark:bg-teal-500/25 dark:text-teal-100',
    rail: 'border-teal-200/80 dark:border-teal-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-teal-500/[0.08] hover:text-foreground dark:hover:bg-teal-950/40',
    linkActive:
      'bg-teal-600/12 font-semibold text-teal-950 shadow-sm dark:bg-teal-500/22 dark:text-teal-50',
  },
  orange: {
    wrap: 'rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-500/[0.07] via-background/95 to-amber-500/[0.04] p-2 shadow-sm dark:border-orange-500/30 dark:from-orange-950/45 dark:to-amber-950/20',
    iconWrap: 'bg-orange-500/18 text-orange-800 shadow-inner dark:bg-orange-500/25 dark:text-orange-100',
    rail: 'border-orange-200/80 dark:border-orange-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-orange-500/[0.08] hover:text-foreground dark:hover:bg-orange-950/40',
    linkActive:
      'bg-orange-600/12 font-semibold text-orange-950 shadow-sm dark:bg-orange-500/22 dark:text-orange-50',
  },
  emerald: {
    wrap: 'rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/[0.07] via-background/95 to-green-500/[0.05] p-2 shadow-sm dark:border-emerald-500/30 dark:from-emerald-950/45 dark:to-green-950/20',
    iconWrap: 'bg-emerald-500/18 text-emerald-800 shadow-inner dark:bg-emerald-500/25 dark:text-emerald-100',
    rail: 'border-emerald-200/80 dark:border-emerald-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-emerald-500/[0.08] hover:text-foreground dark:hover:bg-emerald-950/40',
    linkActive:
      'bg-emerald-600/12 font-semibold text-emerald-950 shadow-sm dark:bg-emerald-500/22 dark:text-emerald-50',
  },
  cyan: {
    wrap: 'rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-500/[0.07] via-background/95 to-sky-500/[0.05] p-2 shadow-sm dark:border-cyan-500/30 dark:from-cyan-950/45 dark:to-sky-950/20',
    iconWrap: 'bg-cyan-500/18 text-cyan-800 shadow-inner dark:bg-cyan-500/25 dark:text-cyan-100',
    rail: 'border-cyan-200/80 dark:border-cyan-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-cyan-500/[0.08] hover:text-foreground dark:hover:bg-cyan-950/40',
    linkActive:
      'bg-cyan-600/12 font-semibold text-cyan-950 shadow-sm dark:bg-cyan-500/22 dark:text-cyan-50',
  },
  sky: {
    wrap: 'rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-500/[0.07] via-background/95 to-cyan-500/[0.05] p-2 shadow-sm dark:border-sky-500/30 dark:from-sky-950/50 dark:to-cyan-950/20',
    iconWrap: 'bg-sky-500/18 text-sky-700 shadow-inner dark:bg-sky-500/25 dark:text-sky-200',
    rail: 'border-sky-200/80 dark:border-sky-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-sky-500/[0.08] hover:text-foreground dark:hover:bg-sky-950/40',
    linkActive:
      'bg-sky-600/12 font-semibold text-sky-900 shadow-sm dark:bg-sky-500/20 dark:text-sky-50',
  },
  violet: {
    wrap: 'rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-500/[0.08] via-background/95 to-fuchsia-500/[0.06] p-2 shadow-sm dark:border-violet-500/35 dark:from-violet-950/55 dark:to-fuchsia-950/25',
    iconWrap: 'bg-violet-500/18 text-violet-800 shadow-inner dark:bg-violet-500/28 dark:text-violet-100',
    rail: 'border-violet-200/80 dark:border-violet-600/40',
    linkIdle:
      'text-muted-foreground hover:bg-violet-500/[0.09] hover:text-foreground dark:hover:bg-violet-950/45',
    linkActive:
      'bg-violet-600/14 font-semibold text-violet-950 shadow-sm dark:bg-violet-500/25 dark:text-white',
  },
  zinc: {
    wrap: 'rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-500/[0.06] via-background/95 to-neutral-500/[0.04] p-2 shadow-sm dark:border-zinc-600/40 dark:from-zinc-950/50 dark:to-neutral-950/20',
    iconWrap: 'bg-zinc-500/15 text-zinc-700 shadow-inner dark:bg-zinc-500/22 dark:text-zinc-200',
    rail: 'border-zinc-200/80 dark:border-zinc-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-zinc-500/[0.08] hover:text-foreground dark:hover:bg-zinc-950/40',
    linkActive:
      'bg-zinc-600/12 font-semibold text-zinc-900 shadow-sm dark:bg-zinc-500/22 dark:text-zinc-50',
  },
  indigo: {
    wrap: 'rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-500/[0.08] via-background/95 to-blue-500/[0.05] p-2 shadow-sm dark:border-indigo-500/35 dark:from-indigo-950/50 dark:to-blue-950/25',
    iconWrap: 'bg-indigo-500/18 text-indigo-800 shadow-inner dark:bg-indigo-500/26 dark:text-indigo-100',
    rail: 'border-indigo-200/80 dark:border-indigo-600/40',
    linkIdle:
      'text-muted-foreground hover:bg-indigo-500/[0.09] hover:text-foreground dark:hover:bg-indigo-950/45',
    linkActive:
      'bg-indigo-600/14 font-semibold text-indigo-950 shadow-sm dark:bg-indigo-500/25 dark:text-indigo-50',
  },
  fuchsia: {
    wrap: 'rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-500/[0.07] via-background/95 to-pink-500/[0.05] p-2 shadow-sm dark:border-fuchsia-500/30 dark:from-fuchsia-950/45 dark:to-pink-950/20',
    iconWrap: 'bg-fuchsia-500/18 text-fuchsia-800 shadow-inner dark:bg-fuchsia-500/25 dark:text-fuchsia-100',
    rail: 'border-fuchsia-200/80 dark:border-fuchsia-600/35',
    linkIdle:
      'text-muted-foreground hover:bg-fuchsia-500/[0.08] hover:text-foreground dark:hover:bg-fuchsia-950/40',
    linkActive:
      'bg-fuchsia-600/12 font-semibold text-fuchsia-950 shadow-sm dark:bg-fuchsia-500/22 dark:text-fuchsia-50',
  },
};

function filterPublicMenuTree(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const item of items) {
    if (item.heading) continue;
    if (item.children?.length) {
      const pubKids = item.children.filter((c) => c.publicAccess);
      if (pubKids.length === 0) continue;
      out.push({ ...item, children: pubKids });
      continue;
    }
    if (item.publicAccess) out.push(item);
  }
  return out;
}

function filterMenuTree(
  items: MenuItem[],
  role: WebAdminRole | null,
  moderatorModules?: string[] | null,
  schoolEnabledModules?: string[] | null,
  supportEnabled = true,
): MenuItem[] {
  if (!role) return filterPublicMenuTree(items);
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

function resolveTitle(item: MenuItem, role: WebAdminRole | null, schoolEnabledModules?: string[] | null): string {
  if (item.path === '/classes-subjects' && schoolEnabledModules?.includes('bilsem')) {
    return 'Gruplar ve Dersler';
  }
  return (role && item.titleByRole?.[role]) ?? item.title ?? '';
}

function MenuLinkRow({
  item,
  role,
  schoolEnabledModules,
  isActive,
  getBadgeCount,
  groupVariant,
}: {
  item: MenuItem;
  role: WebAdminRole | null;
  schoolEnabledModules?: string[] | null;
  isActive: (path?: string) => boolean;
  getBadgeCount: (item: MenuItem) => number;
  groupVariant?: MenuGroupKey;
}) {
  if (!item.path) return null;
  const active = isActive(item.path);
  const badgeCount = getBadgeCount(item);
  const displayTitle = resolveTitle(item, role, schoolEnabledModules);
  const g = groupVariant ? GROUP_SHELL[groupVariant] : null;

  return (
    <Link
      href={item.path}
      data-selected={active}
      className={cn(
        'flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        g
          ? active
            ? g.linkActive
            : g.linkIdle
          : [
              'hover:bg-muted/75 hover:text-foreground',
              active
                ? 'bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15 dark:bg-primary/20 dark:text-primary dark:ring-primary/25'
                : 'text-muted-foreground',
            ],
        badgeCount > 0 && 'relative',
      )}
    >
      {item.icon && (
        <item.icon
          data-slot="accordion-menu-icon"
          className={cn('size-[18px] shrink-0 opacity-90', active && !g && 'opacity-100')}
          aria-hidden
        />
      )}
      <span data-slot="accordion-menu-title" className="flex-1 leading-snug">
        {displayTitle}
      </span>
      {badgeCount > 0 && (
        <span
          data-slot="badge"
          className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white shadow-sm"
          aria-label={`${badgeCount} okunmamış mesaj`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );
}

function MenuBranch({
  item,
  role,
  schoolEnabledModules,
  isActive,
  getBadgeCount,
  variant,
}: {
  item: MenuItem;
  role: WebAdminRole | null;
  schoolEnabledModules?: string[] | null;
  isActive: (path?: string) => boolean;
  getBadgeCount: (item: MenuItem) => number;
  variant: MenuGroupKey;
}) {
  const shell = GROUP_SHELL[variant];
  const displayParent = resolveTitle(item, role, schoolEnabledModules);
  const childActive = item.children?.some((c) => c.path && isActive(c.path)) ?? false;
  const showSubLabel =
    (variant === 'indigo' && (role === 'superadmin' || role === 'moderator')) ||
    (variant === 'sky' && (role === 'school_admin' || role === 'teacher'));

  return (
    <div className={cn('space-y-1.5', shell.wrap)}>
      <div
        className={cn(
          'flex items-center gap-2.5 px-1.5 pb-0.5 pt-0.5',
          childActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {item.icon && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', shell.iconWrap)}>
            <item.icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span
            data-slot="accordion-menu-title"
            className="block text-sm font-bold leading-tight tracking-tight text-foreground"
          >
            {displayParent}
          </span>
          {showSubLabel && (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/85">
              Alt menü
            </span>
          )}
        </div>
      </div>
      <div
        className={cn('menu-branch-rail ml-2 space-y-0.5 border-l-2 pl-2.5', shell.rail)}
        aria-label={`${displayParent} alt menü`}
      >
        {item.children?.map((child) => (
          <MenuLinkRow
            key={child.path ?? child.title}
            item={child}
            role={role}
            schoolEnabledModules={schoolEnabledModules}
            isActive={isActive}
            getBadgeCount={getBadgeCount}
            groupVariant={variant}
          />
        ))}
      </div>
    </div>
  );
}

export function SidebarMenu({ role, moderatorModules, schoolEnabledModules }: SidebarMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const { supportEnabled } = useSupportModuleAvailability();
  const supportEnabledValue = supportEnabled ?? true;
  const adminMessagesUnread = useAdminMessagesUnread(token, me?.role ?? null);
  const allNotificationsUnread = useAllNotificationsUnread(token, me?.role ?? null);

  const items = filterMenuTree(MENU_SIDEBAR, role, moderatorModules, schoolEnabledModules, supportEnabledValue);

  const getBadgeCount = (item: MenuItem): number => {
    if (item.badgeKey === 'adminMessagesUnread') return adminMessagesUnread;
    if (item.badgeKey === 'dutyNotificationsUnread') return allNotificationsUnread;
    return 0;
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    const [base, queryStr] = path.split('?');
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
    if (!queryStr) {
      if (base === '/reklamlar') {
        return searchParams.get('tab') !== 'invite';
      }
      return pathname === base || pathname.startsWith(`${base}/`);
    }
    const expected = new URLSearchParams(queryStr);
    for (const key of expected.keys()) {
      if (searchParams.get(key) !== expected.get(key)) return false;
    }
    return true;
  };

  return (
    <div className="kt-scrollable-y-hover flex grow shrink-0 overflow-y-auto px-2.5 py-4 lg:max-h-[calc(100vh-5.5rem)]">
      <nav className="w-full space-y-1.5" role="navigation" aria-label="Ana menü">
        {items.map((item, idx) => {
          if (item.heading) {
            return (
              <div
                key={`heading-${idx}`}
                data-slot="accordion-menu-label"
                className="px-2 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75 first:pt-1"
              >
                {item.heading}
              </div>
            );
          }
          if (item.children?.length) {
            const variant = item.menuGroup ?? DEFAULT_MENU_GROUP;
            return (
              <MenuBranch
                key={`branch-${item.title}-${idx}`}
                item={item}
                role={role}
                schoolEnabledModules={schoolEnabledModules}
                isActive={isActive}
                getBadgeCount={getBadgeCount}
                variant={variant}
              />
            );
          }
          if (!item.path) return null;
          return (
            <MenuLinkRow
              key={item.path}
              item={item}
              role={role}
              schoolEnabledModules={schoolEnabledModules}
              isActive={isActive}
              getBadgeCount={getBadgeCount}
            />
          );
        })}
      </nav>
    </div>
  );
}
