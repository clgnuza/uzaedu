'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
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
  /** Mobil açılır menü: dar panel, küçük tip */
  compact?: boolean;
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
    if (role && item.hiddenInSidebarForRoles?.includes(role)) continue;

    if (item.children?.length) {
      if (!item.allowedRoles.includes(role)) continue;
      if (role === 'moderator' && item.requiredModule) {
        if (!moderatorModules?.includes(item.requiredModule)) continue;
      }
      if ((role === 'teacher' || role === 'school_admin') && item.requiredSchoolModule) {
        if (schoolEnabledModules?.length && !schoolEnabledModules.includes(item.requiredSchoolModule)) continue;
      }
      const kids = filterMenuTree(item.children, role, moderatorModules, schoolEnabledModules, supportEnabled);
      const hubOnly = !!(role && item.sidebarHubOnlyRoles?.includes(role));
      if (hubOnly) {
        out.push({
          ...item,
          children: [],
          renderAsHubOnly: true,
          hubOnlyPath: item.sidebarHubPath ?? '/hesaplamalar',
        });
        continue;
      }
      if (kids.length === 0) continue;
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

function itemMatchesQuery(
  item: MenuItem,
  needle: string,
  role: WebAdminRole | null,
  schoolEnabledModules?: string[] | null,
): boolean {
  const t = resolveTitle(item, role, schoolEnabledModules).toLocaleLowerCase('tr-TR');
  if (t.includes(needle)) return true;
  const path = item.hubOnlyPath ?? item.path?.split('?')[0];
  if (path && path.toLowerCase().includes(needle)) return true;
  return false;
}

function filterMenuBySearch(
  items: MenuItem[],
  rawQuery: string,
  role: WebAdminRole | null,
  schoolEnabledModules?: string[] | null,
): MenuItem[] {
  const needle = rawQuery.trim().toLocaleLowerCase('tr-TR');
  if (!needle) return items;

  const out: MenuItem[] = [];
  for (const item of items) {
    if (item.heading) continue;

    if (item.renderAsHubOnly && item.hubOnlyPath) {
      if (itemMatchesQuery(item, needle, role, schoolEnabledModules)) out.push(item);
      continue;
    }

    if (item.children?.length) {
      const parentMatch = itemMatchesQuery(item, needle, role, schoolEnabledModules);
      const kids = parentMatch
        ? item.children
        : item.children.filter((c) => c.path && itemMatchesQuery(c, needle, role, schoolEnabledModules));
      if (kids.length > 0) out.push({ ...item, children: kids });
      continue;
    }

    if (item.path && itemMatchesQuery(item, needle, role, schoolEnabledModules)) {
      out.push(item);
    }
  }
  return out;
}

function MenuLinkRow({
  item,
  role,
  schoolEnabledModules,
  isActive,
  getBadgeCount,
  groupVariant,
  compact,
}: {
  item: MenuItem;
  role: WebAdminRole | null;
  schoolEnabledModules?: string[] | null;
  isActive: (path?: string) => boolean;
  getBadgeCount: (item: MenuItem) => number;
  groupVariant?: MenuGroupKey;
  compact?: boolean;
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
      data-nav-active={active ? 'true' : undefined}
      className={cn(
        'flex items-center font-medium transition-all duration-200',
        compact
          ? 'min-h-7 gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] leading-tight'
          : 'min-h-[42px] gap-3 rounded-xl px-3 py-2 text-[13px] lg:min-h-8 lg:gap-2 lg:rounded-lg lg:px-2 lg:py-1.5 lg:text-[12px] lg:leading-snug',
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
          className={cn(
            'shrink-0 opacity-90',
            compact ? 'size-3.5' : 'size-[18px] lg:size-4',
            active && !g && 'opacity-100',
          )}
          aria-hidden
        />
      )}
      <span data-slot="accordion-menu-title" className="flex-1 leading-snug">
        {displayTitle}
      </span>
      {badgeCount > 0 && (
        <span
          data-slot="badge"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white shadow-sm',
            compact
              ? 'h-3.5 min-w-3.5 px-0.5 text-[8px]'
              : 'h-5 min-w-[20px] px-1.5 text-[11px] lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]',
          )}
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
  compact,
}: {
  item: MenuItem;
  role: WebAdminRole | null;
  schoolEnabledModules?: string[] | null;
  isActive: (path?: string) => boolean;
  getBadgeCount: (item: MenuItem) => number;
  variant: MenuGroupKey;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const shell = GROUP_SHELL[variant];
  const displayParent = resolveTitle(item, role, schoolEnabledModules);
  const childActive = item.children?.some((c) => c.path && isActive(c.path)) ?? false;
  const showSubLabel =
    (variant === 'indigo' && (role === 'superadmin' || role === 'moderator')) ||
    (variant === 'sky' && (role === 'school_admin' || role === 'teacher'));

  if (item.renderAsHubOnly && item.hubOnlyPath) {
    const prefixes = item.sidebarHubActivePrefixes ?? [item.hubOnlyPath];
    const hubActive = prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    return (
      <Link
        href={item.hubOnlyPath}
        data-nav-active={hubActive ? 'true' : undefined}
        className={cn(
          shell.wrap,
          'block shadow-sm no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          compact && 'rounded-lg border p-1 shadow-none',
          !compact && 'lg:p-1.5',
          hubActive ? shell.linkActive : shell.linkIdle,
        )}
      >
        <div
          className={cn(
            'flex items-center',
            compact ? 'gap-1.5 px-0.5 py-0.5' : 'gap-2.5 px-1.5 py-1.5 lg:gap-2 lg:px-1 lg:py-1',
          )}
        >
          {item.icon && (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-md',
                compact ? 'size-5' : 'size-8 rounded-lg lg:size-7',
                shell.iconWrap,
              )}
            >
              <item.icon className={compact ? 'size-3' : 'size-4 lg:size-3.5'} aria-hidden />
            </span>
          )}
          <span
            data-slot="accordion-menu-title"
            className={cn(
              'min-w-0 flex-1 font-bold leading-tight tracking-tight text-foreground',
              compact ? 'text-[10px]' : 'text-sm lg:text-[12px]',
            )}
          >
            {displayParent}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        shell.wrap,
        compact ? 'space-y-0.5 rounded-lg border p-1 shadow-none' : 'space-y-1.5 lg:space-y-1 lg:p-1.5',
      )}
    >
      <div
        className={cn(
          'flex items-center',
          compact ? 'gap-1.5 px-0.5 py-0' : 'gap-2.5 px-1.5 pb-0.5 pt-0.5 lg:gap-2 lg:px-1 lg:py-0.5',
          childActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {item.icon && (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md',
              compact ? 'size-5' : 'size-8 rounded-lg lg:size-7',
              shell.iconWrap,
            )}
          >
            <item.icon className={compact ? 'size-3' : 'size-4 lg:size-3.5'} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span
            data-slot="accordion-menu-title"
            className={cn(
              'block font-bold leading-tight tracking-tight text-foreground',
              compact ? 'text-[10px]' : 'text-sm lg:text-[12px]',
            )}
          >
            {displayParent}
          </span>
          {showSubLabel && (
            <span
              className={cn(
                'mt-0.5 block font-medium uppercase text-muted-foreground/85',
                compact ? 'text-[7px] tracking-wide' : 'text-[10px] tracking-[0.12em] lg:text-[9px]',
              )}
            >
              Alt menü
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          'menu-branch-rail space-y-0 border-l',
          compact ? 'ml-1 border-l pl-1.5' : 'ml-2 border-l-2 space-y-0.5 pl-2.5 lg:ml-1.5 lg:pl-2',
          shell.rail,
        )}
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
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export function SidebarMenu({ role, moderatorModules, schoolEnabledModules, compact }: SidebarMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const { supportEnabled } = useSupportModuleAvailability();
  const supportEnabledValue = supportEnabled ?? true;
  const adminMessagesUnread = useAdminMessagesUnread(token, me?.role ?? null);
  const allNotificationsUnread = useAllNotificationsUnread(token, me?.role ?? null);

  const items = filterMenuTree(MENU_SIDEBAR, role, moderatorModules, schoolEnabledModules, supportEnabledValue);

  const [search, setSearch] = useState('');
  const displayItems = useMemo(() => {
    const base = search.trim() ? items.filter((i) => !i.heading) : items;
    return filterMenuBySearch(base, search, role, schoolEnabledModules);
  }, [items, search, role, schoolEnabledModules]);

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

  const menuScrollRef = useRef<HTMLDivElement>(null);
  const skipSmoothNavScrollRef = useRef(true);

  useEffect(() => {
    const root = menuScrollRef.current;
    if (!root || compact) return;
    const activeEl = root.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!activeEl) return;
    const behavior: ScrollBehavior = skipSmoothNavScrollRef.current ? 'auto' : 'smooth';
    skipSmoothNavScrollRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        activeEl.scrollIntoView({ block: 'center', behavior, inline: 'nearest' });
      });
    });
  }, [pathname, searchParams, compact, displayItems.length]);

  return (
    <div
      ref={menuScrollRef}
      className={cn(
        'kt-scrollable-y-hover flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain',
        compact ? 'px-1 py-1.5' : 'px-2.5 py-4 lg:px-2 lg:py-2',
      )}
    >
      <div
        className={cn(
          'sticky top-0 z-10 -mx-0.5 shrink-0 border-b border-border/70 bg-background pb-2',
          compact ? 'mb-1 px-0.5' : 'mb-2 px-0.5 lg:mb-1.5 lg:pb-1.5',
        )}
      >
        <label htmlFor="sidebar-menu-search" className="sr-only">
          Menüde ara
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="sidebar-menu-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Menüde ara…"
            autoComplete="off"
            className={cn(
              'w-full rounded-lg border border-input bg-background pl-9 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
              compact ? 'h-8 pr-2 text-[11px]' : 'h-9 pr-3 text-sm lg:h-8 lg:text-xs',
            )}
          />
        </div>
      </div>
      <nav
        className={cn('min-h-0 w-full flex-1', compact ? 'space-y-0.5' : 'space-y-1.5 lg:space-y-1')}
        role="navigation"
        aria-label="Ana menü"
      >
        {displayItems.map((item, idx) => {
          if (item.heading) {
            return (
              <div
                key={`heading-${idx}`}
                data-slot="accordion-menu-label"
                className={cn(
                  'font-bold uppercase text-muted-foreground/75',
                  compact
                    ? 'px-1 pb-0 pt-2 text-[7px] tracking-wide first:pt-0'
                    : 'px-1.5 pb-1 pt-4 text-[10px] tracking-[0.14em] first:pt-1 lg:px-1 lg:pb-0.5 lg:pt-2.5 lg:text-[9px] lg:first:pt-0.5',
                )}
              >
                {item.heading}
              </div>
            );
          }
          if (item.renderAsHubOnly || (item.children?.length ?? 0) > 0) {
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
                compact={compact}
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
              compact={compact}
            />
          );
        })}
        {search.trim() && displayItems.length === 0 && (
          <p className={cn('px-1 text-center text-muted-foreground', compact ? 'py-4 text-[11px]' : 'py-6 text-sm')}>
            Eşleşen menü yok.
          </p>
        )}
      </nav>
    </div>
  );
}
