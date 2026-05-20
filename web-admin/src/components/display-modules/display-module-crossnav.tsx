'use client';

import Link from 'next/link';
import { Monitor, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Duyuru TV ↔ Akıllı Tahta — işlevler ayrı modüllerde kalır. */
export function DisplayModuleCrossNav({ current }: { current: 'tv' | 'smart_board' }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Link
            href="/tv"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm',
              current === 'tv'
                ? 'border-cyan-500/50 bg-linear-to-r from-cyan-600/15 to-indigo-600/15 text-cyan-900 shadow-sm ring-1 ring-cyan-500/25 dark:text-cyan-100'
                : 'border-border/80 bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Tv className="size-3.5 shrink-0" />
            Duyuru TV
          </Link>
          <Link
            href="/akilli-tahta"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm',
              current === 'smart_board'
                ? 'border-teal-500/50 bg-linear-to-r from-teal-600/15 to-violet-600/15 text-teal-900 shadow-sm ring-1 ring-teal-500/25 dark:text-teal-100'
                : 'border-border/80 bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Monitor className="size-3.5 shrink-0" />
            Akıllı Tahta
          </Link>
        </div>
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground sm:max-w-[min(100%,32rem)] sm:text-sm lg:text-right">
          {current === 'tv'
            ? 'QR, PIN ve tahta kilidi Akıllı Tahta modülündedir. Bu sayfa duyuru ve TV cihazları içindir.'
            : 'Kurulum ve QR onayı burada. Tahta varsayılan Duyuru TV; öğretmen QR ile kullanım moduna geçer.'}
        </p>
      </div>
    </div>
  );
}
