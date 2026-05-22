'use client';

import { DdStudioEntityNav } from '@/components/ders-dagit/dd-studio-entity-nav';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function DdEntityListShell({ title, toolbar, actions, children, className }: Props) {
  return (
    <div className={cn('flex min-h-0 flex-col gap-3 lg:flex-row lg:gap-4', className)}>
      <aside className="shrink-0 lg:w-14">
        <DdStudioEntityNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
            {toolbar}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">{children}</div>
        </div>
        {actions ? (
          <aside className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-36 lg:flex-col lg:border-l lg:pl-3">
            {actions}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
