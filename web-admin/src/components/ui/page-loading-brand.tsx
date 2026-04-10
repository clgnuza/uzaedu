'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const VIDEO_SRC = '/media/sayfa-yukleniyor.mp4';

type PageLoadingBrandProps = {
  className?: string;
  /** "shell" = route guard kartı; "page" = tam sayfa / spinner varyantı */
  density?: 'shell' | 'page';
};

export function PageLoadingBrand({ className, density = 'shell' }: PageLoadingBrandProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  const isPage = density === 'page';

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          isPage
            ? 'shadow-[0_12px_40px_-12px_rgba(14,116,144,0.35)] ring-1 ring-sky-500/15 dark:shadow-[0_16px_48px_-16px_rgba(56,189,248,0.2)] dark:ring-sky-400/10'
            : 'shadow-md ring-1 ring-slate-200/80 dark:ring-white/10',
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 opacity-90',
            isPage
              ? 'bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-500/10 dark:from-sky-500/15 dark:to-emerald-500/8'
              : 'bg-gradient-to-br from-sky-500/8 via-transparent to-teal-500/8 dark:from-sky-500/12',
          )}
          aria-hidden
        />
        <video
          ref={ref}
          className={cn(
            'relative z-[1] block object-contain',
            isPage
              ? 'h-14 w-14 max-h-[16vw] max-w-[16vw] sm:h-[4.25rem] sm:w-[4.25rem] sm:max-h-none sm:max-w-none'
              : 'h-12 w-12 max-h-[14vw] max-w-[14vw] sm:h-14 sm:w-14 sm:max-h-none sm:max-w-none',
          )}
          src={VIDEO_SRC}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
        />
      </div>

      <div className="flex w-full max-w-40 flex-col items-center gap-2 sm:max-w-44">
        <div
          className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
          aria-hidden
        >
          <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 motion-safe:animate-page-load-bar motion-reduce:animate-none dark:from-sky-400 dark:via-teal-400 dark:to-emerald-400" />
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-sky-500/75 motion-safe:animate-bounce motion-reduce:animate-none dark:bg-sky-400/90 sm:size-2"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
