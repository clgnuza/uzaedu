'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DtInfoHint({
  title,
  className,
}: {
  /** Tarayıcı tooltip + erişilebilir isim */
  title: string;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center justify-center text-muted-foreground hover:text-primary', className)}
      title={title}
      role="img"
      aria-label={title}
    >
      <Info className="size-3.5 shrink-0" aria-hidden />
    </span>
  );
}
