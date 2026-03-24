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
};

export function ToolbarIconHints({ items, summary, className, compact }: Props) {
  return (
    <>
      <p className="sr-only">{summary}</p>
      <div
        className={cn(
          'flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2',
          !compact && 'mt-2',
          className,
        )}
        role="group"
        aria-label={summary}
      >
        {items.map(({ label, icon: Icon }) => (
          <span
            key={label}
            title={label}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/35 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground sm:size-9"
          >
            <Icon className="size-3.5 sm:size-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </span>
        ))}
      </div>
    </>
  );
}
