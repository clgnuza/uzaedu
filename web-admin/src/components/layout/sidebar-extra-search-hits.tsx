'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SidebarExtraHit = { path: string; title: string };

type Props = {
  hits: SidebarExtraHit[];
  isActive: (path?: string) => boolean;
  compact?: boolean;
};

export function SidebarExtraSearchHits({ hits, isActive, compact }: Props) {
  if (hits.length === 0) return null;
  return (
    <div className={cn('mt-2 border-t border-border/60 pt-2', compact && 'mt-1.5 pt-1.5')}>
      <p
        className={cn(
          'mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground',
          compact ? 'px-0.5 text-[7px]' : 'px-1 text-[10px] tracking-[0.12em]',
        )}
      >
        Modül / ayar
      </p>
      <div className={cn('space-y-0.5', compact && 'space-y-0')}>
        {hits.map((h) => {
          const active = isActive(h.path);
          return (
            <Link
              key={h.path}
              href={h.path}
              className={cn(
                'flex items-center gap-2 rounded-lg font-medium transition-colors',
                compact
                  ? 'min-h-7 px-1.5 py-0.5 text-[10px] leading-tight'
                  : 'min-h-[40px] px-2.5 py-1.5 text-[12px] lg:min-h-8 lg:px-2 lg:py-1 lg:text-[11px]',
                active
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/20'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              <Settings className={cn('shrink-0 opacity-80', compact ? 'size-3' : 'size-3.5')} aria-hidden />
              <span className="min-w-0 flex-1 leading-snug">{h.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
