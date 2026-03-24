'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
/** Sayfa başlığı alanı (Metronic Toolbar benzeri). */
export function Toolbar({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 border-b border-border/35 pb-5 pt-0.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarActions({ children }: { children?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 min-w-0">{children}</div>;
}

export function ToolbarHeading({ children }: { children: ReactNode }) {
  return <div className="flex flex-col justify-center gap-1.5">{children}</div>;
}

export function ToolbarPageTitle({
  children,
  className,
}: { children?: ReactNode; className?: string }) {
  return (
    <h1 className={cn('text-xl font-semibold leading-tight tracking-tight text-foreground lg:text-2xl', className)}>
      {children}
    </h1>
  );
}

export function ToolbarDescription({ children }: { children?: ReactNode }) {
  return <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
