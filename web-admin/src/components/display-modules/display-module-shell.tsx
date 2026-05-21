'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Monitor, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DisplayModuleCrossNav } from './display-module-crossnav';

const VARIANT_STYLES = {
  tv: {
    page: 'max-sm:from-cyan-500/6 max-sm:to-indigo-500/10 dark:max-sm:from-cyan-950/45 dark:max-sm:to-indigo-950/35',
    header:
      'border-cyan-500/20 bg-linear-to-br from-cyan-500/8 via-card/95 to-indigo-500/6 ring-cyan-500/15 dark:from-cyan-950/40 dark:via-card/90 dark:to-indigo-950/30 dark:ring-cyan-500/20',
    body: 'ring-cyan-500/8 dark:ring-cyan-400/10',
    icon: 'from-cyan-500/20 to-indigo-500/15 text-cyan-700 dark:text-cyan-300',
    Icon: Tv,
  },
  smart_board: {
    page: 'max-sm:from-teal-500/6 max-sm:to-violet-500/10 dark:max-sm:from-teal-950/45 dark:max-sm:to-violet-950/35',
    header:
      'border-teal-500/20 bg-linear-to-br from-teal-500/8 via-card/95 to-violet-500/6 ring-teal-500/15 dark:from-teal-950/40 dark:via-card/90 dark:to-violet-950/30 dark:ring-teal-500/20',
    body: 'ring-teal-500/8 dark:ring-teal-400/10',
    icon: 'from-teal-500/20 to-violet-500/15 text-teal-700 dark:text-teal-300',
    Icon: Monitor,
  },
} as const;

export function DisplayModuleShell({
  variant,
  title,
  subtitle,
  schoolBadge,
  headerActions,
  filterBar,
  tabNav,
  highlights,
  children,
}: {
  variant: keyof typeof VARIANT_STYLES;
  title: string;
  subtitle: string;
  schoolBadge?: string | null;
  headerActions?: ReactNode;
  filterBar?: ReactNode;
  tabNav?: ReactNode;
  highlights?: Array<{ label: string; icon?: LucideIcon }>;
  children: ReactNode;
}) {
  const v = VARIANT_STYLES[variant];
  const ModuleIcon = v.Icon;

  return (
    <div
      className={cn(
        'display-module-page mx-auto w-full max-w-7xl space-y-4 px-1 sm:space-y-6 sm:px-2 lg:px-0',
        'max-sm:-mx-2 max-sm:rounded-2xl max-sm:bg-linear-to-b max-sm:via-background max-sm:px-3 max-sm:pb-3 max-sm:pt-1',
        v.page,
      )}
    >
      <header
        className={cn(
          'overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md supports-backdrop-filter:bg-card/90',
          v.header,
        )}
      >
        <div className="space-y-4 border-b border-border/50 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6">
          <DisplayModuleCrossNav current={variant} />

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
            <div className="flex min-w-0 gap-3 sm:gap-4">
              <div
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br shadow-inner ring-1 ring-white/25 sm:size-14',
                  v.icon,
                )}
                aria-hidden
              >
                <ModuleIcon className="size-6 sm:size-7" strokeWidth={2} />
              </div>
              <div className="min-w-0 w-full max-w-3xl flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">{title}</h1>
                  {schoolBadge ? (
                    <span className="inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/90 px-2.5 py-0.5 text-[10px] font-semibold text-foreground/90 sm:text-xs">
                      {schoolBadge}
                    </span>
                  ) : null}
                </div>
                <p className="w-full text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
                {highlights && highlights.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5 pt-0.5">
                    {highlights.map((h) => {
                      const Icon = h.icon;
                      return (
                        <li
                          key={h.label}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground sm:text-xs"
                        >
                          {Icon ? <Icon className="size-3 shrink-0 opacity-80" aria-hidden /> : null}
                          {h.label}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
            {headerActions ? (
              <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:max-w-sm lg:justify-end">
                {headerActions}
              </div>
            ) : null}
          </div>

          {filterBar ? <div className="min-w-0 w-full">{filterBar}</div> : null}
        </div>
        {tabNav ? (
          <div className="border-t border-border/40 bg-muted/20 px-2 py-2.5 sm:px-4 sm:py-3">{tabNav}</div>
        ) : null}
      </header>

      <div
        className={cn(
          'display-module-body min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm ring-1 backdrop-blur-sm dark:bg-card/80',
          v.body,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Öğretmen QR / oturum alanı — admin TV içeriğinden görsel ayrım */
export function DisplayModuleTeacherLane({ children }: { children: ReactNode }) {
  return (
    <section
      className={cn(
        'display-module-teacher-lane space-y-2 sm:space-y-3',
        'max-sm:-mx-1 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:ring-0',
        'sm:rounded-2xl sm:border sm:border-violet-300/30 sm:bg-linear-to-br sm:from-violet-500/5 sm:via-background sm:to-sky-500/5 sm:p-4 sm:shadow-sm sm:ring-1 sm:ring-violet-500/10',
        'dark:sm:border-violet-800/40 dark:sm:from-violet-950/20 dark:sm:to-sky-950/15',
      )}
      aria-label="Öğretmen tahta işlemleri"
    >
      {children}
    </section>
  );
}
