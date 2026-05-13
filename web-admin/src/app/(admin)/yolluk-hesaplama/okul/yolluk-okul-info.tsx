'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function YollukInfoTrigger({
  active,
  onClick,
  ariaLabel = 'Açıklama',
}: {
  active: boolean;
  onClick: () => void;
  /** Ekran okuyucu ve araç ipuçları için */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:text-primary ring-offset-background shrink-0 rounded-full p-1 transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active && 'bg-primary/15 text-primary',
      )}
      aria-expanded={active}
      aria-label={ariaLabel}
    >
      <CircleHelp className="size-4 sm:size-[18px]" />
    </button>
  );
}

export function YollukInfoBody({
  show,
  children,
  className,
  layout = 'static',
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** overlay: aşağıdaki satırları itmez (absolute panel) */
  layout?: 'static' | 'overlay';
}) {
  if (!show) return null;
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-xs leading-relaxed sm:text-[13px]',
        layout === 'overlay'
          ? 'bg-card text-card-foreground border-border absolute left-0 top-full z-40 mt-1 w-full max-h-[min(70vh,28rem)] overflow-y-auto border-2 shadow-xl ring-1 ring-black/10 dark:ring-white/15'
          : 'bg-muted text-foreground border-border border shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
