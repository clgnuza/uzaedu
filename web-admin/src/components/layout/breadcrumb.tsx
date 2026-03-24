'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, House } from 'lucide-react';
import { getBreadcrumbs } from '@/config/menu';
import type { WebAdminRole } from '@/config/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const items = getBreadcrumbs(pathname ?? '', me?.role as WebAdminRole | undefined);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-muted/25 px-2.5 py-1.5 text-[13px] font-medium shadow-sm backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:text-sm',
        className,
      )}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const showHome = i === 0 && item.path === '/dashboard';
        return (
          <span key={i} className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/80 sm:size-4" aria-hidden />}
            {item.path && !last ? (
              <Link
                href={item.path}
                className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showHome ? (
                  <>
                    <House className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            ) : (
              <span
                className={cn(
                  'min-w-0 truncate',
                  last ? 'text-foreground' : 'text-muted-foreground',
                )}
                aria-current={last ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
