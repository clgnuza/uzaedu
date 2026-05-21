'use client';

import { cn } from '@/lib/utils';

/** Mobil sıkı; lg+ yan sütun, geniş masaüstü */
export function OptikPageShell({
  children,
  sidebar,
  className,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'optik-shell mx-auto min-h-dvh w-full max-w-lg px-2 pb-20 pt-1.5 sm:px-3',
        'md:max-w-3xl md:px-4',
        'lg:max-w-6xl lg:px-6 lg:pb-8 lg:pt-3',
        className,
      )}
    >
      <div
        className={cn(
          sidebar &&
            'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6',
        )}
      >
        <div className="min-w-0 space-y-2 md:space-y-2.5">{children}</div>
        {sidebar ? (
          <aside className="mt-2 hidden min-w-0 space-y-2 lg:sticky lg:top-3 lg:mt-0 lg:block lg:self-start">
            {sidebar}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
