'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Calculator,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  Link2,
  Mail,
  Newspaper,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { GuestPublicWebShellNav, GuestPublicWebShellNavItem } from '@/lib/web-extras-public';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  newspaper: Newspaper,
  calculator: Calculator,
  star: Star,
  layout: LayoutDashboard,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  'help-circle': HelpCircle,
  mail: Mail,
  link: Link2,
};

function ShellNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (href.startsWith('https://')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function pathnameMatch(pathname: string, href: string): boolean {
  if (href.startsWith('https://')) return false;
  const base = href.split('?')[0] || '';
  const p = pathname.split('?')[0] || '';
  return p === base || (base !== '/' && p.startsWith(`${base}/`));
}

function ItemIcon({ item }: { item: GuestPublicWebShellNavItem }) {
  const Icon = (item.icon_key && ICON_MAP[item.icon_key]) || Link2;
  return <Icon className="size-3.5 opacity-80 sm:size-4" aria-hidden />;
}

export function GuestPublicShellTopBar({ nav }: { nav: GuestPublicWebShellNav }) {
  const pathname = usePathname();
  const items = nav.top_bar_items;
  if (!nav.top_bar_enabled || items.length === 0) return null;
  return (
    <nav
      className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-1"
      aria-label="Sayfa bağlantıları"
    >
      {items.map((it) => {
        const active = pathnameMatch(pathname ?? '', it.href);
        return (
          <ShellNavLink
            key={`${it.href}-${it.label}`}
            href={it.href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:text-sm',
              active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ItemIcon item={it} />
            <span className="max-w-[7rem] truncate sm:max-w-[9rem]">{it.label}</span>
          </ShellNavLink>
        );
      })}
    </nav>
  );
}

export function GuestPublicShellBottomBar({
  nav,
  isMobile,
}: {
  nav: GuestPublicWebShellNav;
  isMobile: boolean;
}) {
  const pathname = usePathname();
  const items = nav.bottom_bar_items;
  if (!nav.bottom_bar_enabled || items.length === 0) return null;
  if (nav.bottom_bar_mobile_only && !isMobile) return null;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-background/75 print:hidden"
      aria-label="Alt gezinme"
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around gap-0 px-0.5 pt-1">
        {items.map((it) => {
          const active = pathnameMatch(pathname ?? '', it.href);
          const Icon = (it.icon_key && ICON_MAP[it.icon_key]) || Link2;
          return (
            <div key={`${it.href}-${it.label}`} className="flex min-w-0 flex-1 flex-col items-center justify-center">
              <ShellNavLink
                href={it.href}
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-medium sm:text-xs',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="w-full truncate text-center leading-tight">{it.label}</span>
              </ShellNavLink>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
