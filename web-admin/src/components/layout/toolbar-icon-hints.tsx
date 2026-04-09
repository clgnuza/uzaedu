'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolbarHintItem = { label: string; icon: LucideIcon };

type Props = {
  items: ToolbarHintItem[];
  /** Tam açıklama — sr-only + grup aria-label */
  summary: string;
  className?: string;
  /** true: üst boşluk yok (yanında büyük ikon kutusu vb. olduğunda) */
  compact?: boolean;
  /** false (varsayılan): mobilde gizli. true: tek satır yatay kaydırma (bildirimler vb.) */
  showOnMobile?: boolean;
};

export function ToolbarIconHints({ items, summary, className, compact, showOnMobile }: Props) {
  return (
    <>
      <p className="sr-only">{summary}</p>
      <div
        className={cn(
          'max-w-full flex flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden',
          !showOnMobile && 'hidden sm:flex',
          !compact && 'mt-1.5 sm:mt-2',
          className,
        )}
        role="group"
        aria-label={summary}
      >
        {items.map(({ label, icon: Icon }) => (
          <span
            key={label}
            title={label}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/35 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground sm:size-9 sm:rounded-lg"
          >
            <Icon className="size-3 sm:size-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </span>
        ))}
      </div>
    </>
  );
}
